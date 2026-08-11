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
// Overridable without a redeploy — see the pre-warming pool section below.
// CONFIRMED (Aug 2026) via isolated A/B test that pre-warming actively
// HURTS IPRoyal: with pooling on, real customer-credential requests
// through this gateway averaged ~2.3s (20-request sample, 1.9-3.9s range)
// vs. raw IPRoyal (no gateway) at ~0.85-0.93s — the tunnel/CONNECT itself
// opened fast either way (~750-900ms, see connect_established durationMs),
// but data through a pooled-then-reused socket took an extra ~1.4s versus
// a socket dialed fresh at the moment of use. Retested with
// UPSTREAM_POOL_SIZE=1 (pooling effectively disabled): 8/8 requests
// landed at 0.76-0.84s, matching or beating raw IPRoyal, consistently.
// IPRoyal appears to penalize (or just serve slowly through) a TCP
// connection that's sat idle/pre-opened rather than one just dialed —
// pre-warming optimizes for the wrong thing against this upstream. Default
// is now 1 (effectively no pooling) until this is retested per-upstream
// (Bright Data's behavior here is untested, not assumed identical).
const UPSTREAM_POOL_SIZE = Number(process.env.UPSTREAM_POOL_SIZE || 1);
// Overridable per-destination via a SiteRule's connectionTimeoutMs (see
// gateway-tuning.ts) — /resolve returns null when no rule sets one, in
// which case every call site here falls back to this same default that
// was previously just hardcoded inline.
const DEFAULT_CONNECTION_TIMEOUT_MS = 30_000;
// How long to wait after a CONNECT tunnel is established, with zero bytes
// flowing in either direction, before treating the exit IP as dead and
// closing the tunnel cleanly (see the dead-tunnel watchdog in
// handleConnect). Generous relative to a real TLS handshake (normally well
// under 1s) so this only fires on genuinely stuck connections, not slow
// ones — the goal is catching "nothing will ever happen here," not shaving
// latency off working-but-slow connections.
const DEAD_TUNNEL_GRACE_MS = Number(process.env.DEAD_TUNNEL_GRACE_MS || 4_000);

if (!AGENT_SECRET) {
  console.error("GATEWAY_AGENT_SECRET is not set — refusing to start.");
  process.exit(1);
}

// ---- Structured diagnostic logging --------------------------------------
//
// One JSON line per connection lifecycle event, so failures are actually
// queryable (grep by event/errorClass/host) instead of free-text messages.

function classifyError(err, context) {
  if (context === "timeout" || err?.message === "timeout") return "TIMEOUT";
  const code = err?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS";
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"].includes(code)) {
    return "TCP";
  }
  if (code === "ETIMEDOUT") return "TIMEOUT";
  // Only reachable if some future code path dials an upstream leg with
  // tls.connect() directly — today every upstream socket is plain
  // net.connect() (CONNECT is relayed as opaque bytes, this process never
  // terminates TLS itself), so this branch is inert but correct: the
  // gateway has no visibility into a TLS handshake between the client and
  // the target through an established tunnel, only ever into its own
  // upstream leg, and only if that leg is ever TLS itself.
  if (code === "EPROTO" || (typeof code === "string" && code.startsWith("ERR_TLS_")) || (typeof code === "string" && code.startsWith("CERT_"))) {
    return "TLS";
  }
  return "OTHER";
}

// ---- Connection-stats reporting (destination-aware routing) -------------
//
// Buffered locally and flushed periodically (see STATS_FLUSH_INTERVAL_MS)
// rather than one HTTP call per connection — this process handles many
// concurrent connections and a per-connection call to the control API
// would be a meaningful load multiplier for no benefit, since nothing
// downstream (recomputeHealthScores) needs per-event latency. Never
// blocks/slows the actual client connection: recordConnectionStat only
// pushes into an in-memory array, the flush happens on its own timer.

const STATS_FLUSH_INTERVAL_MS = 10_000;
const STATS_BATCH_MAX = 500; // matches connectionStatsIngestSchema's max array length
let statsBuffer = [];

function recordConnectionStat({
  targetHost,
  providerSlug,
  success,
  errorClass,
  connectLatencyMs,
  bytesUploaded,
  bytesDownloaded,
  sessionId,
}) {
  if (!targetHost || !providerSlug) return; // can't bucket a stat with no destination/pool — drop it rather than guess
  statsBuffer.push({
    targetHost,
    providerSlug,
    success,
    errorClass: errorClass || undefined,
    connectLatencyMs: Math.max(0, Math.round(connectLatencyMs)),
    bytesUploaded: bytesUploaded || 0,
    bytesDownloaded: bytesDownloaded || 0,
    sessionId: sessionId || undefined,
    occurredAt: new Date().toISOString(),
  });
  // Flush early if the buffer is getting large, rather than waiting for the
  // timer and risking a batch bigger than the endpoint accepts.
  if (statsBuffer.length >= STATS_BATCH_MAX) flushConnectionStats();
}

function flushConnectionStats() {
  if (statsBuffer.length === 0) return;
  const events = statsBuffer;
  statsBuffer = [];
  controlApiFetch("/api/gateway-control/connection-stats", { events }).catch((err) => {
    console.error("connection-stats flush failed:", err.message);
    // Dropped, not re-queued — these are rolling health stats, not billing
    // data; losing one batch during a control-API blip doesn't need
    // retry complexity, and re-queueing risks an unbounded buffer if the
    // control API is down for a while.
  });
}
setInterval(flushConnectionStats, STATS_FLUSH_INTERVAL_MS).unref();

function logEvent(event, fields) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), event, ...fields }),
  );
}

// Reused across all plain-HTTP upstream requests — Node's Agent already
// pools/reuses sockets per host:port internally, so this alone gets
// connection reuse for that path without any custom pooling logic (the
// CONNECT/HTTPS path can't use an http.Agent since it's raw TCP, hence the
// hand-rolled pool below). Deliberately a SEPARATE constant from
// UPSTREAM_POOL_SIZE, not tied to it — Node's http.Agent keep-alive reuse
// is a different mechanism (a socket is reused across many sequential
// requests as they complete, not handed out once like the CONNECT pool),
// and there's no evidence yet that it has the same "idle connection is
// slow" problem confirmed for the CONNECT-path pool against IPRoyal.
// Below real peak concurrent traffic to one upstream host:port, requests
// past this cap queue behind it instead of failing — which reads as
// "slow," not as an error, making it an easy bottleneck to miss.
const HTTP_AGENT_MAX_SOCKETS = Number(process.env.HTTP_AGENT_MAX_SOCKETS || 60);
const httpUpstreamAgent = new http.Agent({ keepAlive: true, maxSockets: HTTP_AGENT_MAX_SOCKETS });

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

// targetHost is intentionally NOT part of the cache key — it's sent so the
// app can apply a per-site SiteRule override on a cache-miss/actual
// resolve, not to fragment this cache per-destination (that would mean a
// hit to the control API on every single new site a client requests,
// defeating the point of caching at all). A per-site rule change may take
// up to CACHE_TTL_MS to apply to a credential mid-cache-window — the same
// staleness this cache already accepts for any other credential-state
// change.
async function resolveCredential(username, password, forceRotate = false, targetHost = undefined) {
  if (!forceRotate) {
    const cached = resolveCache.get(username);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
  }

  const { ok, data } = await controlApiFetch("/api/gateway-control/resolve", {
    username,
    password,
    forceRotate,
    targetHost,
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

// ---- Upstream connection pre-warming (see UPSTREAM_POOL_SIZE's comment
// above for the IPRoyal A/B test result — pooling was found to actively
// HURT that upstream, which is why the default is now 1) --------------
//
// In theory: opening a fresh TCP connection to the upstream on every
// single client CONNECT costs a full handshake round-trip before the
// CONNECT line can even be sent, so keeping a pool of already-open, idle
// sockets per upstream host:port should let most requests skip that RTT.
// Each pooled socket is used for exactly one client's tunnel and then
// discarded (never returned to the pool) — this was only ever meant to
// avoid handshake latency, never to share a socket's data between two
// different client sessions.
//
// In practice, at least for IPRoyal: a connection that sat pre-opened in
// the pool before being used measured consistently slower end-to-end than
// one dialed fresh at the moment of use, even though the CONNECT handshake
// itself was fast either way — something about IPRoyal's own handling of
// an idle-then-reused vs. freshly-dialed connection. So raising
// UPSTREAM_POOL_SIZE is NOT a safe default fix for "slow" against this
// upstream — it was tried (60) and made things markedly worse. Only
// increase this for a specific upstream after A/B testing that one
// upstream the same way (real customer credential, pooled vs.
// UPSTREAM_POOL_SIZE=1, same target, back-to-back timed samples) — do not
// assume the theory above holds without that evidence in hand.
const POOL_SIZE = UPSTREAM_POOL_SIZE;
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

// Counts, since the last pool-status log, how many takeFromPool() calls
// found the pool empty and fell through to a cold (unwarmed) connection —
// the direct signal that POOL_SIZE is too small for real traffic, as
// opposed to inferring it after the fact from ConnectionEvent latency.
const coldFallbacksByKey = new Map(); // "host:port" -> count

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
  } else {
    coldFallbacksByKey.set(key, (coldFallbacksByKey.get(key) || 0) + 1);
  }
  replenishPool(host, port);
  return sock || net.connect(port, host);
}

function logPoolStatus() {
  for (const [key, pool] of connectionPools) {
    logEvent("pool_status", {
      upstream: key,
      poolSize: pool.size,
      targetSize: POOL_SIZE,
      coldFallbacks: coldFallbacksByKey.get(key) || 0,
    });
  }
  coldFallbacksByKey.clear();
}
setInterval(logPoolStatus, 60_000).unref();

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
  const startedAtMs = Date.now();
  let finished = false;
  let bytesUp = 0;
  let bytesDown = 0;
  // Set once the CONNECT establishment attempt sequence resolves
  // (success or final failure) — finish() reports the connection-stats
  // event using whichever of these was recorded, carrying bandwidth
  // totals that are only known once the connection actually closes. Kept
  // as exactly one ConnectionEvent per connection attempt (not one at
  // handshake-time and a separate one at close) so totalAttempts/success
  // rate aren't double-counted.
  let pendingConnectionStat = null;

  const [targetHost, targetPortStr] = req.url.split(":");
  const targetPort = targetPortStr || "443";

  const finish = (gatewayHostname, credentialUsername) => {
    if (finished) return;
    finished = true;
    activeConnections--;
    if (gatewayHostname && credentialUsername) {
      reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
    }
    if (pendingConnectionStat) {
      recordConnectionStat({ ...pendingConnectionStat, bytesUploaded: bytesUp, bytesDownloaded: bytesDown });
    }
  };

  const deny = (status) => {
    clientSocket.end(`HTTP/1.1 ${status}\r\n\r\n`);
    finish();
  };

  const auth = parseProxyAuth(req.headers["proxy-authorization"]);
  if (!auth) return deny("407 Proxy Authentication Required");

  // One retry with a forced-fresh upstream session (different exit IP) if
  // the current one fails to reach the target — a single bad/blocked IP
  // shouldn't take down every request on a credential until it's next
  // resolved from a cold cache. Only ever retries once: a target that's
  // genuinely unreachable (or blocking us specifically) shouldn't retry
  // forever.
  function attempt(forceRotate) {
    resolveCredential(auth.username, auth.password, forceRotate, targetHost)
      .then((resolved) => {
        if (!resolved) return deny("407 Proxy Authentication Required");

        const { upstream, gatewayHostname, credentialUsername, sessionId, providerSlug } = resolved;
        let handshakeDone = false;
        let attemptFailed = false;

        const failAttempt = (reason, err) => {
          if (attemptFailed || handshakeDone) return;
          attemptFailed = true;
          upstreamSocket.destroy();
          const errorClass = classifyError(err, reason);
          if (!forceRotate) {
            logEvent("connect_retry", {
              username: auth.username,
              sessionId,
              destination: `${targetHost}:${targetPort}`,
              upstream: `${upstream.host}:${upstream.port}`,
              errorClass,
              reason,
            });
            attempt(true);
          } else {
            logEvent("connect_failed", {
              username: auth.username,
              sessionId,
              destination: `${targetHost}:${targetPort}`,
              upstream: `${upstream.host}:${upstream.port}`,
              errorClass,
              reason,
              durationMs: Date.now() - startedAtMs,
              retried: true,
            });
            // Recorded once per whole attempt sequence (only once forceRotate's
            // retry is exhausted), not once per sub-attempt — failover already
            // happened above during upstream selection; this is the final
            // outcome for the connection as a whole. finish() below is what
            // actually reports it, once bandwidth totals are known.
            pendingConnectionStat = {
              targetHost,
              providerSlug,
              success: false,
              errorClass,
              connectLatencyMs: Date.now() - startedAtMs,
              sessionId,
            };
            clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            finish(gatewayHostname, credentialUsername);
          }
        };

        const upstreamSocket = takeFromPool(upstream.host, upstream.port);
        upstreamSocket.setTimeout(resolved.connectionTimeoutMs || DEFAULT_CONNECTION_TIMEOUT_MS, () =>
          failAttempt("timeout"),
        );

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
          const connectStatusCode = Number(statusLine.match(/^HTTP\/1\.[01]\s+(\d+)/)?.[1]) || null;

          if (connectStatusCode !== 200) {
            failAttempt(`upstream rejected: ${statusLine}`);
            return;
          }

          handshakeDone = true;
          const establishedDurationMs = Date.now() - startedAtMs;
          logEvent("connect_established", {
            username: auth.username,
            sessionId,
            destination: `${targetHost}:${targetPort}`,
            upstream: `${upstream.host}:${upstream.port}`,
            connectStatusCode,
            durationMs: establishedDurationMs,
            retried: forceRotate,
          });
          // Reported by finish() once the connection closes, so bandwidth
          // totals are included in the same event rather than a second one.
          pendingConnectionStat = {
            targetHost,
            providerSlug,
            success: true,
            connectLatencyMs: establishedDurationMs,
            sessionId,
          };
          clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n", () => {
            if (head && head.length) {
              bytesUp += head.length;
              upstreamSocket.write(head);
            }
            if (remainder.length) {
              bytesDown += remainder.length;
              clientSocket.write(remainder);
            }

            // Post-handshake dead-tunnel watchdog: the CONNECT tunnel itself
            // succeeded, but that only proves the upstream reached the
            // TARGET's TCP port — it says nothing about whether the exit IP
            // can actually complete a real TLS handshake / serve real
            // traffic through it. A bad exit IP commonly shows up here as
            // silence: the client sends its TLS ClientHello (or plain HTTP
            // request) immediately after "200 Connection Established," and
            // if the exit IP is dead, nothing ever comes back — no upstream
            // 'error' or 'close' event fires either, since the TCP-level
            // tunnel is still technically open. Confirmed in production
            // (Aug 2026): curl reported exit 35 (SSL connect error) on
            // exactly this pattern, invisible to the retry logic above
            // because that logic only ever covers failures BEFORE
            // handshakeDone.
            //
            // This does NOT replay the client's request — replaying
            // anything after a tunnel is established is deliberately out of
            // scope (the gateway only relays opaque bytes past this point,
            // it has no framing to safely retry). Instead, if zero bytes
            // have flowed in either direction after DEAD_TUNNEL_GRACE_MS,
            // both sockets are closed cleanly. A well-behaved HTTP client
            // (curl, browsers, most HTTP libraries) treats a cleanly closed
            // connection as retry-safe and opens a fresh one automatically
            // — which lands on a NEW CONNECT to this gateway, going through
            // the existing exit-IP-rotation logic naturally, same as any
            // other fresh connection.
            let sawTraffic = false;
            const deadTunnelTimer = setTimeout(() => {
              if (sawTraffic) return;
              logEvent("dead_tunnel_detected", {
                username: auth.username,
                sessionId,
                destination: `${targetHost}:${targetPort}`,
                upstream: `${upstream.host}:${upstream.port}`,
                graceMs: DEAD_TUNNEL_GRACE_MS,
              });
              recordConnectionStat({
                targetHost,
                providerSlug,
                success: false,
                errorClass: "DEAD_TUNNEL",
                connectLatencyMs: Date.now() - startedAtMs,
                sessionId,
              });
              pendingConnectionStat = null; // superseded by the DEAD_TUNNEL stat just recorded — don't also report it as a success in finish()
              clientSocket.destroy();
              upstreamSocket.destroy();
            }, DEAD_TUNNEL_GRACE_MS);

            clientSocket.on("data", (d) => {
              sawTraffic = true;
              clearTimeout(deadTunnelTimer);
              bytesUp += d.length;
            });
            upstreamSocket.on("data", (d) => {
              sawTraffic = true;
              clearTimeout(deadTunnelTimer);
              bytesDown += d.length;
            });
            clientSocket.pipe(upstreamSocket);
            upstreamSocket.pipe(clientSocket);
          });
        }
        upstreamSocket.on("data", onUpstreamHandshakeData);

        upstreamSocket.on("error", (err) => failAttempt(err.message, err));
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
        logEvent("resolve_failed", { username: auth.username, error: err.message });
        deny("502 Bad Gateway");
      });
  }

  attempt(false);
}

// ---- Plain HTTP proxying (absolute-URI requests) ------------------------

const MAX_RETRY_SAFE_BODY_BYTES = 10 * 1024 * 1024; // 10MB

// ---- Block/challenge detection (plain-HTTP path only) -------------------
//
// Only applies here, not to CONNECT/HTTPS — a CONNECT tunnel relays opaque
// TLS bytes, so the gateway has no visibility into the target's response
// there. On this path we do see status + a body prefix, so a same-IP
// block/CAPTCHA challenge can be told apart from an ordinary origin 403/429
// and retried on a fresh exit IP instead of being handed to the customer.
//
// Deliberately narrow: only the status codes these systems actually use,
// plus body markers specific enough that a legitimate site's own 403 page
// won't false-positive on them.

const BLOCK_STATUS_CODES = new Set([403, 429, 503]);
const BLOCK_BODY_MARKERS = [
  "hcaptcha",
  "h-captcha",
  "g-recaptcha",
  "recaptcha",
  "cf-challenge",
  "cf_chl_",
  "checking your browser",
  "attention required | cloudflare",
  "perimeterx",
  "_px-captcha",
  "datadome",
  "please verify you are a human",
];
const BLOCK_SNIFF_BYTES = 64 * 1024;

function looksLikeBlockPage(statusCode, headers, bodyPrefix) {
  if (!BLOCK_STATUS_CODES.has(statusCode)) return false;
  const contentType = String(headers["content-type"] || "");
  if (!contentType.includes("html") && !contentType.includes("json") && contentType !== "") {
    return false;
  }
  const text = bodyPrefix.toString("utf8").toLowerCase();
  return BLOCK_BODY_MARKERS.some((marker) => text.includes(marker));
}

async function handleHttpRequest(req, res) {
  activeConnections++;
  const startedAtMs = Date.now();
  const done = () => {
    activeConnections--;
  };

  const auth = parseProxyAuth(req.headers["proxy-authorization"]);
  if (!auth) {
    res.writeHead(407, { "Proxy-Authenticate": 'Basic realm="proxy"' });
    res.end();
    return done();
  }

  let requestHostname;
  try {
    requestHostname = new URL(req.url).hostname;
  } catch {
    res.writeHead(400);
    res.end("Bad Request — expected absolute-URI");
    return done();
  }

  // Bodies under the cap get buffered up front so a failed first attempt
  // can be retried against a fresh upstream session (the stream can't be
  // re-read once consumed). Above the cap — or with no declared
  // Content-Length, since it could be arbitrarily large — stream directly
  // instead: buffering a multi-GB upload in memory to enable a retry that
  // will rarely happen isn't a reasonable tradeoff. Streamed requests lose
  // the automatic retry-on-failure; that's logged explicitly below rather
  // than silently.
  const declaredLength = Number(req.headers["content-length"]);
  const canBufferForRetry =
    Number.isFinite(declaredLength) && declaredLength > 0 && declaredLength <= MAX_RETRY_SAFE_BODY_BYTES;

  let body = null;
  if (canBufferForRetry) {
    const bodyChunks = [];
    for await (const chunk of req) bodyChunks.push(chunk);
    body = Buffer.concat(bodyChunks);
  }

  function attempt(forceRotate) {
    resolveCredential(auth.username, auth.password, forceRotate, requestHostname).then((resolved) => {
      if (!resolved) {
        res.writeHead(407);
        res.end();
        return done();
      }
      const { upstream, gatewayHostname, credentialUsername, sessionId, providerSlug, connectionTimeoutMs } =
        resolved;

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
        agent: httpUpstreamAgent,
      });
      proxyReq.setTimeout(connectionTimeoutMs || DEFAULT_CONNECTION_TIMEOUT_MS, () =>
        proxyReq.destroy(new Error("timeout")),
      );

      proxyReq.on("response", (upstreamRes) => {
        // A same-IP block/CAPTCHA challenge is only worth detecting (and
        // retrying) when we can safely resend the request — same constraint
        // as the error-path retry below. Otherwise skip straight to the
        // normal passthrough.
        const canCheckForBlock =
          !forceRotate && canBufferForRetry && BLOCK_STATUS_CODES.has(upstreamRes.statusCode);

        const establishedDurationMs = Date.now() - startedAtMs;

        if (!canCheckForBlock) {
          logEvent("http_established", {
            username: auth.username,
            sessionId,
            destination: req.url,
            upstream: `${upstream.host}:${upstream.port}`,
            status: upstreamRes.statusCode,
            durationMs: establishedDurationMs,
            retried: forceRotate,
            streamedBody: !canBufferForRetry,
          });
          res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
          upstreamRes.on("data", (d) => (bytesDown += d.length));
          upstreamRes.pipe(res);
          upstreamRes.on("end", () => {
            done();
            reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
            recordConnectionStat({
              targetHost: requestHostname,
              providerSlug,
              success: true,
              connectLatencyMs: establishedDurationMs,
              bytesUploaded: bytesUp,
              bytesDownloaded: bytesDown,
              sessionId,
            });
          });
          return;
        }

        // Buffer just enough of the body to sniff for a challenge page
        // before committing headers to the client — once res.writeHead()
        // is called the status/headers can't be taken back.
        const sniffChunks = [];
        let sniffLength = 0;
        let decided = false;

        const finishPassthrough = (firstChunk) => {
          decided = true;
          const finishDurationMs = Date.now() - startedAtMs;
          logEvent("http_established", {
            username: auth.username,
            sessionId,
            destination: req.url,
            upstream: `${upstream.host}:${upstream.port}`,
            status: upstreamRes.statusCode,
            durationMs: finishDurationMs,
            retried: forceRotate,
            streamedBody: !canBufferForRetry,
          });
          res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
          if (firstChunk) {
            bytesDown += firstChunk.length;
            res.write(firstChunk);
          }
          upstreamRes.on("data", (d) => (bytesDown += d.length));
          upstreamRes.pipe(res);
          upstreamRes.on("end", () => {
            done();
            reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
            recordConnectionStat({
              targetHost: requestHostname,
              providerSlug,
              success: true,
              connectLatencyMs: finishDurationMs,
              bytesUploaded: bytesUp,
              bytesDownloaded: bytesDown,
              sessionId,
            });
          });
        };

        upstreamRes.on("data", function onSniffChunk(chunk) {
          sniffChunks.push(chunk);
          sniffLength += chunk.length;
          if (sniffLength < BLOCK_SNIFF_BYTES) return;
          upstreamRes.removeListener("data", onSniffChunk);
          finishPassthrough(Buffer.concat(sniffChunks, sniffLength));
        });

        upstreamRes.on("end", () => {
          if (decided) return;
          const bodyPrefix = Buffer.concat(sniffChunks, sniffLength);
          if (looksLikeBlockPage(upstreamRes.statusCode, upstreamRes.headers, bodyPrefix)) {
            logEvent("http_retry", {
              username: auth.username,
              sessionId,
              destination: req.url,
              upstream: `${upstream.host}:${upstream.port}`,
              errorClass: "BLOCKED",
              reason: `target returned ${upstreamRes.statusCode} with a block/challenge page`,
            });
            attempt(true);
            return;
          }
          finishPassthrough(bodyPrefix);
        });
      });

      proxyReq.on("error", (err) => {
        const errorClass = classifyError(err, err.message);
        // A request whose body we already streamed straight through can't
        // be safely retried — the upstream may have received a partial
        // body. Only bodies we buffered up front are safe to replay.
        if (!forceRotate && (canBufferForRetry || bytesUp === 0)) {
          logEvent("http_retry", {
            username: auth.username,
            sessionId,
            destination: req.url,
            upstream: `${upstream.host}:${upstream.port}`,
            errorClass,
            reason: err.message,
          });
          attempt(true);
          return;
        }
        const failedDurationMs = Date.now() - startedAtMs;
        logEvent("http_failed", {
          username: auth.username,
          sessionId,
          destination: req.url,
          upstream: `${upstream.host}:${upstream.port}`,
          errorClass,
          reason: err.message,
          durationMs: failedDurationMs,
          retried: forceRotate,
        });
        done();
        recordConnectionStat({
          targetHost: requestHostname,
          providerSlug,
          success: false,
          errorClass,
          connectLatencyMs: failedDurationMs,
          bytesUploaded: bytesUp,
          bytesDownloaded: bytesDown,
          sessionId,
        });
        try {
          res.writeHead(502);
          res.end("Bad Gateway");
        } catch {}
      });

      if (canBufferForRetry) {
        bytesUp = body.length;
        proxyReq.end(body);
      } else {
        req.on("data", (d) => (bytesUp += d.length));
        req.pipe(proxyReq);
      }
    });
  }

  attempt(false);
}

// ---- WebSocket (plain ws://) upgrade -------------------------------------
//
// wss:// (the vast majority of real-world WebSocket traffic) already works
// with zero extra code — it's TLS, so clients tunnel it via CONNECT exactly
// like HTTPS, and handleConnect relays it as opaque bytes. Plain ws://,
// though, arrives as a standard HTTP upgrade request in absolute-URI form,
// which Node's http.Server delivers via a separate 'upgrade' event — NOT
// the normal 'request' event handleHttpRequest listens on. Without a
// listener here, a plain ws:// connection through this proxy just hangs:
// nothing ever responds to it.

async function handleUpgrade(req, clientSocket, head) {
  activeConnections++;
  const startedAtMs = Date.now();
  let bytesUp = 0;
  let bytesDown = 0;
  const finish = (gatewayHostname, credentialUsername) => {
    activeConnections--;
    if (gatewayHostname && credentialUsername) {
      reportUsage(gatewayHostname, credentialUsername, bytesUp, bytesDown);
    }
  };

  const auth = parseProxyAuth(req.headers["proxy-authorization"]);
  if (!auth) {
    clientSocket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
    return finish();
  }

  let requestHostname;
  try {
    requestHostname = new URL(req.url).hostname;
  } catch {
    // Malformed URL — resolveCredential still runs below (this handler
    // doesn't 400 on it, unlike handleHttpRequest), just without a
    // per-site rule lookup for this one request.
  }

  const resolved = await resolveCredential(auth.username, auth.password, false, requestHostname).catch(
    () => null,
  );
  if (!resolved) {
    clientSocket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
    return finish();
  }
  const { upstream, gatewayHostname, credentialUsername, sessionId, providerSlug, connectionTimeoutMs } =
    resolved;
  let upgradeEstablished = false;

  const upstreamSocket = net.connect(upstream.port, upstream.host);
  upstreamSocket.setTimeout(connectionTimeoutMs || DEFAULT_CONNECTION_TIMEOUT_MS, () =>
    upstreamSocket.destroy(new Error("timeout")),
  );

  upstreamSocket.once("connect", () => {
    const headers = { ...req.headers };
    delete headers["proxy-connection"];
    headers["proxy-authorization"] =
      "Basic " + Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");
    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    upstreamSocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
    if (head && head.length) {
      bytesUp += head.length;
      upstreamSocket.write(head);
    }
    upgradeEstablished = true;
    const establishedDurationMs = Date.now() - startedAtMs;
    logEvent("upgrade_established", {
      username: auth.username,
      sessionId,
      destination: req.url,
      upstream: `${upstream.host}:${upstream.port}`,
      durationMs: establishedDurationMs,
    });
    recordConnectionStat({
      targetHost: requestHostname,
      providerSlug,
      success: true,
      connectLatencyMs: establishedDurationMs,
      sessionId,
    });
    clientSocket.on("data", (d) => (bytesUp += d.length));
    upstreamSocket.on("data", (d) => (bytesDown += d.length));
    clientSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(clientSocket);
  });

  upstreamSocket.on("error", (err) => {
    const errorClass = classifyError(err, err.message);
    logEvent("upgrade_failed", {
      username: auth.username,
      sessionId,
      destination: req.url,
      upstream: `${upstream.host}:${upstream.port}`,
      errorClass,
      reason: err.message,
      durationMs: Date.now() - startedAtMs,
    });
    // Only a pre-establishment failure counts as a failed connection
    // attempt for routing purposes — an error on an already-established
    // tunnel (e.g. the client's WS session just ending) isn't a connect
    // failure, same distinction handleConnect makes.
    if (!upgradeEstablished) {
      recordConnectionStat({
        targetHost: requestHostname,
        providerSlug,
        success: false,
        errorClass,
        connectLatencyMs: Date.now() - startedAtMs,
        sessionId,
      });
    }
    clientSocket.destroy();
    finish(gatewayHostname, credentialUsername);
  });
  upstreamSocket.on("close", () => {
    clientSocket.destroy();
    finish(gatewayHostname, credentialUsername);
  });
  clientSocket.on("error", () => upstreamSocket.destroy());
  clientSocket.on("close", () => upstreamSocket.destroy());
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

server.on("upgrade", (req, clientSocket, head) => {
  clientSocket.on("error", () => {});
  handleUpgrade(req, clientSocket, head).catch((err) => {
    console.error("upgrade handling error:", err.message);
    clientSocket.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`Gateway agent listening on :${PORT}, reporting as ${GATEWAY_HOSTNAME}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
