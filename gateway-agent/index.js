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

async function resolveCredential(username, password) {
  const cached = resolveCache.get(username);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const { ok, data } = await controlApiFetch("/api/gateway-control/resolve", {
    username,
    password,
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
  let settled = false;
  let bytesUp = 0;
  let bytesDown = 0;

  const finish = (gatewayHostname, credentialUsername) => {
    if (settled) return;
    settled = true;
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

  resolveCredential(auth.username, auth.password)
    .then((resolved) => {
      if (!resolved) return deny("407 Proxy Authentication Required");

      const { upstream, gatewayHostname, credentialUsername } = resolved;
      const [targetHost, targetPortStr] = req.url.split(":");
      const targetPort = targetPortStr || "443";

      const upstreamSocket = net.connect(upstream.port, upstream.host);
      upstreamSocket.setTimeout(30_000, () => upstreamSocket.destroy());

      upstreamSocket.once("connect", () => {
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
          if (responseBuffer.length > 16_384) {
            clientSocket.destroy();
            upstreamSocket.destroy();
            finish();
          }
          return;
        }
        upstreamSocket.removeListener("data", onUpstreamHandshakeData);
        const statusLine = responseBuffer.slice(0, responseBuffer.indexOf("\r\n")).toString();
        const remainder = responseBuffer.slice(headerEnd + 4);

        if (!/^HTTP\/1\.[01]\s+200/.test(statusLine)) {
          clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
          upstreamSocket.destroy();
          finish(gatewayHostname, credentialUsername);
          return;
        }

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

      upstreamSocket.on("error", (err) => {
        console.error(`upstream error for ${targetHost}:${targetPort}:`, err.message);
        clientSocket.destroy();
        finish(gatewayHostname, credentialUsername);
      });
      upstreamSocket.on("close", () => {
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

  const resolved = await resolveCredential(auth.username, auth.password).catch(() => null);
  if (!resolved) {
    res.writeHead(407);
    res.end();
    return done();
  }
  const { upstream, gatewayHostname, credentialUsername } = resolved;

  try {
    new URL(req.url);
  } catch {
    res.writeHead(400);
    res.end("Bad Request — expected absolute-URI");
    return done();
  }

  const headers = { ...req.headers };
  delete headers["proxy-connection"];
  headers["proxy-authorization"] =
    "Basic " + Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");

  let bytesUp = 0;
  let bytesDown = 0;

  const proxyReq = http.request({
    host: upstream.host,
    port: upstream.port,
    method: req.method,
    path: req.url,
    headers,
  });

  req.on("data", (d) => (bytesUp += d.length));
  req.pipe(proxyReq);

  proxyReq.on("response", (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.on("data", (d) => (bytesDown += d.length));
    upstreamRes.pipe(res);
    upstreamRes.on("end", () => {
      done();
      reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
    });
  });

  proxyReq.on("error", (err) => {
    console.error("upstream request error:", err.message);
    done();
    try {
      res.writeHead(502);
      res.end("Bad Gateway");
    } catch {}
  });
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
