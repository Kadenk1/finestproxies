"use strict";

// Standalone forward-proxy daemon. Accepts HTTP CONNECT (for HTTPS) and
// plain absolute-URI HTTP proxy requests, authenticates each against the
// main app's Gateway Control API, and relays traffic to whatever upstream
// provider that credential resolves to (Bright Data, IPRoyal, ...).
//
// This process never touches the database or SECRETS_ENCRYPTION_KEY —
// every credential check and the literal upstream host/port/auth come from
// POST /api/gateway-control/resolve, authenticated with GATEWAY_AGENT_SECRET.

const http = require("http");
const net = require("net");
const { randomUUID } = require("crypto");

const CONTROL_API_BASE = process.env.CONTROL_API_BASE || "http://app:3000";
const AGENT_SECRET = process.env.GATEWAY_AGENT_SECRET;
const GATEWAY_HOSTNAME = process.env.GATEWAY_HOSTNAME || "proxy.finestproxies.com";
const PORT = Number(process.env.PORT || 8000);

if (!AGENT_SECRET) {
  console.error("GATEWAY_AGENT_SECRET is not set — refusing to start.");
  process.exit(1);
}

// Reused across all plain-HTTP upstream requests — Node's Agent already
// pools/reuses sockets per host:port internally, so this alone gets
// connection reuse for that path without any custom pooling logic (the
// CONNECT/HTTPS path can't use an http.Agent since it's raw TCP, hence the
// hand-rolled pool below).
const httpUpstreamAgent = new http.Agent({ keepAlive: true, maxSockets: 32 });

// ---- Control API -----------------------------------------------------

async function controlApiFetch(path, body) {
  const res = await fetch(`${CONTROL_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AGENT_SECRET}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

// Short cache so a busy connection doesn't hit the control API on every
// single request — credential state changes rarely enough that a 45s
// staleness window is a fine tradeoff.
const resolveCache = new Map(); // username -> { data, expiresAt }
const CACHE_TTL_MS = 45_000;

async function resolveCredential(username, password, forceRotate = false) {
  if (!forceRotate) {
    const cached = resolveCache.get(username);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
  }

  const { ok, data } = await controlApiFetch("/api/gateway-control/resolve", {
    username,
    password,
    forceRotate,
  }).catch(() => ({ ok: false, data: null }));
  if (!ok || !data) return null;

  resolveCache.set(username, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function reportUsage(gatewayHostname, credentialUsername, bytesUploaded, bytesDownloaded) {
  if (bytesUploaded === 0 && bytesDownloaded === 0) return;
  controlApiFetch("/api/gateway-control/usage", {
    gatewayHostname,
    credentialUsername,
    bytesUploaded,
    bytesDownloaded,
    requestCount: 1,
    dedupeKey: randomUUID(),
  }).catch((err) => console.error("usage report failed:", err.message));
}

let activeConnections = 0;
const startedAt = Date.now();

function sendHeartbeat() {
  controlApiFetch("/api/gateway-control/heartbeat", {
    hostname: GATEWAY_HOSTNAME,
    status: "HEALTHY",
    activeConnections,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }).catch((err) => console.error("heartbeat failed:", err.message));
}
setInterval(sendHeartbeat, 60_000).unref();

// ---- Upstream connection pre-warming ------------------------------------
//
// Opening a fresh TCP connection to the upstream on every single client
// CONNECT costs a full handshake round-trip before we can even send the
// CONNECT line. Keeping a small pool of already-open, idle sockets per
// upstream host:port lets most requests skip that RTT — pull an
// already-connected socket, issue CONNECT immediately. Each pooled socket
// is used for exactly one client's tunnel and then discarded (never
// returned to the pool) — this only avoids handshake latency, it never
// shares a socket's data between two different client sessions.

const POOL_SIZE = 4;
const connectionPools = new Map(); // "host:port" -> Set<net.Socket>, idle + (maybe still connecting)

function poolKey(host, port) {
  return `${host}:${port}`;
}

function replenishPool(host, port) {
  const key = poolKey(host, port);
  let pool = connectionPools.get(key);
  if (!pool) {
    pool = new Set();
    connectionPools.set(key, pool);
  }
  while (pool.size < POOL_SIZE) {
    const sock = net.connect(port, host);
    sock.on("error", () => pool.delete(sock));
    sock.on("close", () => pool.delete(sock));
    pool.add(sock);
  }
}

/** Pulls an idle (connected or still-connecting) socket from the pool, refilling behind it. */
function takeFromPool(host, port) {
  const key = poolKey(host, port);
  const pool = connectionPools.get(key);
  let sock = null;
  if (pool && pool.size > 0) {
    sock = pool.values().next().value;
    pool.delete(sock);
    sock.removeAllListeners("error");
    sock.removeAllListeners("close");
  }
  replenishPool(host, port);
  return sock || net.connect(port, host);
}

/** A net.Socket only fires 'connect' once — a pooled socket may have already connected before this listener is attached. */
function onceConnected(sock, cb) {
  if (!sock.connecting && !sock.destroyed) cb();
  else sock.once("connect", cb);
}

// ---- Auth --------------------------------------------------------------

function parseProxyAuth(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx === -1) return null;
  return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}

// ---- CONNECT (HTTPS tunneling) -----------------------------------------

function handleConnect(req, clientSocket, head) {
  activeConnections++;
  let finished = false;
  let bytesUp = 0;
  let bytesDown = 0;

  const finish = (gatewayHostname, credentialUsername) => {
    if (finished) return;
    finished = true;
    activeConnections--;
    if (gatewayHostname && credentialUsername) {
      reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
    }
  };

  const deny = (status) => {
    clientSocket.end(`HTTP/1.1 ${status}\r\n\r\n`);
    finish();
  };

  const auth = parseProxyAuth(req.headers["proxy-authorization"]);
  if (!auth) return deny("407 Proxy Authentication Required");

  const [targetHost, targetPortStr] = req.url.split(":");
  const targetPort = targetPortStr || "443";

  // One retry with a forced-fresh upstream session (different exit IP) if
  // the current one fails to reach the target — a single bad/blocked IP
  // shouldn't take down every request on a credential until it's next
  // resolved from a cold cache. Only ever retries once: a target that's
  // genuinely unreachable (or blocking us specifically) shouldn't retry
  // forever.
  function attempt(forceRotate) {
    resolveCredential(auth.username, auth.password, forceRotate)
      .then((resolved) => {
        if (!resolved) return deny("407 Proxy Authentication Required");

        const { upstream, gatewayHostname, credentialUsername } = resolved;
        let handshakeDone = false;
        let attemptFailed = false;

        const failAttempt = (reason) => {
          if (attemptFailed || handshakeDone) return;
          attemptFailed = true;
          upstreamSocket.destroy();
          if (!forceRotate) {
            console.error(
              `retrying ${targetHost}:${targetPort} on a fresh upstream session after: ${reason}`,
            );
            attempt(true);
          } else {
            console.error(`giving up on ${targetHost}:${targetPort} after retry — ${reason}`);
            clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            finish(gatewayHostname, credentialUsername);
          }
        };

        const upstreamSocket = takeFromPool(upstream.host, upstream.port);
        upstreamSocket.setTimeout(30_000, () => failAttempt("timeout"));

        onceConnected(upstreamSocket, () => {
          const upstreamAuth = Buffer.from(`${upstream.username}:${upstream.password}`).toString(
            "base64",
          );
          upstreamSocket.write(
            `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
              `Host: ${targetHost}:${targetPort}\r\n` +
              `Proxy-Authorization: Basic ${upstreamAuth}\r\n` +
              `Connection: keep-alive\r\n\r\n`,
          );
        });

        let responseBuffer = Buffer.alloc(0);
        function onUpstreamHandshakeData(chunk) {
          responseBuffer = Buffer.concat([responseBuffer, chunk]);
          const headerEnd = responseBuffer.indexOf("\r\n\r\n");
          if (headerEnd === -1) {
            if (responseBuffer.length > 16_384) failAttempt("oversized handshake response");
            return;
          }
          upstreamSocket.removeListener("data", onUpstreamHandshakeData);
          const statusLine = responseBuffer.slice(0, responseBuffer.indexOf("\r\n")).toString();
          const remainder = responseBuffer.slice(headerEnd + 4);

          if (!/^HTTP\/1\.[01]\s+200/.test(statusLine)) {
            console.error(
              `upstream ${upstream.host}:${upstream.port} rejected CONNECT ${targetHost}:${targetPort} — ${statusLine}`,
            );
            failAttempt(`upstream rejected: ${statusLine}`);
            return;
          }

          handshakeDone = true;
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n", () => {
            if (head && head.length) {
              bytesUp += head.length;
              upstreamSocket.write(head);
            }
            if (remainder.length) {
              bytesDown += remainder.length;
              clientSocket.write(remainder);
            }
            clientSocket.on("data", (d) => (bytesUp += d.length));
            upstreamSocket.on("data", (d) => (bytesDown += d.length));
            clientSocket.pipe(upstreamSocket);
            upstreamSocket.pipe(clientSocket);
          });
        }
        upstreamSocket.on("data", onUpstreamHandshakeData);

        upstreamSocket.on("error", (err) => failAttempt(err.message));
        upstreamSocket.on("close", () => {
          if (!handshakeDone) return failAttempt("closed before handshake completed");
          clientSocket.destroy();
          finish(gatewayHostname, credentialUsername);
        });
        clientSocket.on("error", () => upstreamSocket.destroy());
        clientSocket.on("close", () => {
          upstreamSocket.destroy();
          finish(gatewayHostname, credentialUsername);
        });
      })
      .catch((err) => {
        console.error("resolve failed:", err.message);
        deny("502 Bad Gateway");
      });
  }

  attempt(false);
}

// ---- Plain HTTP proxying (absolute-URI requests) ------------------------

async function handleHttpRequest(req, res) {
  activeConnections++;
  const done = () => {
    activeConnections--;
  };

  const auth = parseProxyAuth(req.headers["proxy-authorization"]);
  if (!auth) {
    res.writeHead(407, { "Proxy-Authenticate": 'Basic realm="proxy"' });
    res.end();
    return done();
  }

  try {
    new URL(req.url);
  } catch {
    res.writeHead(400);
    res.end("Bad Request — expected absolute-URI");
    return done();
  }

  // Buffer the request body up front (proxy traffic bodies are small —
  // API calls, form posts) so a failed first attempt can be retried
  // against a fresh upstream session without needing to re-read a stream
  // that's already been consumed.
  const bodyChunks = [];
  for await (const chunk of req) bodyChunks.push(chunk);
  const body = Buffer.concat(bodyChunks);

  function attempt(forceRotate) {
    resolveCredential(auth.username, auth.password, forceRotate).then((resolved) => {
      if (!resolved) {
        res.writeHead(407);
        res.end();
        return done();
      }
      const { upstream, gatewayHostname, credentialUsername } = resolved;

      const headers = { ...req.headers };
      delete headers["proxy-connection"];
      headers["proxy-authorization"] =
        "Basic " + Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");
      if (body.length) headers["content-length"] = String(body.length);

      let bytesDown = 0;
      const proxyReq = http.request({
        host: upstream.host,
        port: upstream.port,
        method: req.method,
        path: req.url,
        headers,
        agent: httpUpstreamAgent,
      });

      proxyReq.on("response", (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.on("data", (d) => (bytesDown += d.length));
        upstreamRes.pipe(res);
        upstreamRes.on("end", () => {
          done();
          reportUsage(gatewayHostname, credentialUsername, body.length, bytesDown);
        });
      });

      proxyReq.on("error", (err) => {
        if (!forceRotate) {
          console.error(`retrying ${req.url} on a fresh upstream session after: ${err.message}`);
          attempt(true);
          return;
        }
        console.error(`giving up on ${req.url} after retry — ${err.message}`);
        done();
        try {
          res.writeHead(502);
          res.end("Bad Gateway");
        } catch {}
      });

      proxyReq.end(body);
    });
  }

  attempt(false);
}

// ---- Server --------------------------------------------------------------

const server = http.createServer((req, res) => {
  handleHttpRequest(req, res).catch((err) => {
    console.error("request handling error:", err.message);
    try {
      res.writeHead(502);
      res.end("Bad Gateway");
    } catch {}
  });
});

server.on("connect", (req, clientSocket, head) => {
  clientSocket.on("error", () => {}); // avoid crashing on ECONNRESET etc.
  try {
    handleConnect(req, clientSocket, head);
  } catch (err) {
    console.error("connect handling error:", err.message);
    clientSocket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Gateway agent listening on :${PORT}, reporting as ${GATEWAY_HOSTNAME}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
