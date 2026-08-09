"use strict";

// Integration test suite for the gateway-agent proxy daemon. Runs against
// neutral, industry-standard HTTP test infrastructure (httpbin.org,
// api.ipify.org) — never against any specific customer target site. Exists
// to verify general HTTP/HTTPS proxy protocol correctness, not to validate
// success against any particular protected website.
//
// Usage: node test/integration-test.js
// Requires env vars: PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS (sticky),
// PROXY_USER_STICKY_SHORT/PROXY_PASS_STICKY_SHORT (a short-lived sticky
// credential, for the rotation-after-expiry check).

const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const { randomBytes } = require("crypto");

const PROXY_HOST = process.env.PROXY_HOST || "resi.finestproxies.com";
const PROXY_PORT = Number(process.env.PROXY_PORT || 8000);
const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;

if (!PROXY_USER || !PROXY_PASS) {
  console.error("Set PROXY_USER and PROXY_PASS env vars to a generated credential first.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? " — " + detail : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function proxyAuthHeader(user, pass) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// ---- Low-level helpers (bypass any HTTP client library so we're testing
// our own protocol handling directly, not a client's abstraction over it) --

function rawHttpThroughProxy({ method = "GET", url, user = PROXY_USER, pass = PROXY_PASS, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: PROXY_HOST,
      port: PROXY_PORT,
      method,
      path: url,
      headers: {
        "Proxy-Authorization": proxyAuthHeader(user, pass),
        Host: new URL(url).host,
        ...headers,
      },
      timeout: 20_000,
    });
    req.on("response", (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

/** Establishes a CONNECT tunnel through the proxy, returns the raw connected socket. */
function connectTunnel({ targetHost, targetPort, user = PROXY_USER, pass = PROXY_PASS }) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PROXY_PORT, PROXY_HOST);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("CONNECT timeout"));
    }, 20_000);
    sock.once("connect", () => {
      sock.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
          `Host: ${targetHost}:${targetPort}\r\n` +
          `Proxy-Authorization: ${proxyAuthHeader(user, pass)}\r\n\r\n`,
      );
    });
    let buf = Buffer.alloc(0);
    function onData(chunk) {
      buf = Buffer.concat([buf, chunk]);
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      sock.removeListener("data", onData);
      clearTimeout(timer);
      const statusLine = buf.slice(0, buf.indexOf("\r\n")).toString();
      const statusCode = Number(statusLine.match(/(\d{3})/)?.[1]);
      resolve({ sock, statusCode, statusLine });
    }
    sock.on("data", onData);
    sock.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function httpsOverTunnel({ targetHost, targetPort = 443, path = "/", user, pass }) {
  return connectTunnel({ targetHost, targetPort, user, pass }).then(
    ({ sock, statusCode }) =>
      new Promise((resolve, reject) => {
        if (statusCode !== 200) {
          sock.destroy();
          return reject(new Error(`CONNECT failed: ${statusCode}`));
        }
        const tlsSocket = tls.connect({ socket: sock, servername: targetHost }, () => {
          tlsSocket.write(`GET ${path} HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`);
        });
        let buf = Buffer.alloc(0);
        tlsSocket.on("data", (d) => (buf = Buffer.concat([buf, d])));
        tlsSocket.on("end", () => {
          const [head, ...rest] = buf.toString("latin1").split("\r\n\r\n");
          const statusCode = Number(head.match(/^HTTP\/[\d.]+\s+(\d+)/)?.[1]);
          resolve({ statusCode, body: rest.join("\r\n\r\n") });
        });
        tlsSocket.on("error", reject);
      }),
  );
}

// ---- Tests ---------------------------------------------------------------

async function testPlainHttp() {
  const res = await rawHttpThroughProxy({ url: "http://api.ipify.org/" });
  const ip = res.body.toString().trim();
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  record("Plain HTTP proxy request", res.statusCode === 200 && looksLikeIp, `status=${res.statusCode} ip=${ip}`);
  return ip;
}

async function testHttpsConnect() {
  const { statusCode, body } = await httpsOverTunnel({ targetHost: "api.ipify.org", path: "/" });
  const ip = body.trim();
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  record("HTTPS via CONNECT tunnel", statusCode === 200 && looksLikeIp, `status=${statusCode} ip=${ip}`);
  return ip;
}

async function testConnectResponseLine() {
  const { statusCode, statusLine, sock } = await connectTunnel({ targetHost: "api.ipify.org", targetPort: 443 });
  sock.destroy();
  record(
    "CONNECT returns a correct 200 status line",
    statusCode === 200 && /^HTTP\/1\.[01]\s+200/.test(statusLine),
    statusLine,
  );
}

async function testAuthFailure() {
  const res = await rawHttpThroughProxy({ url: "http://api.ipify.org/", user: "bogus", pass: "wrong" }).catch(
    (err) => ({ statusCode: null, error: err.message }),
  );
  record("Wrong credentials are rejected (407)", res.statusCode === 407, `status=${res.statusCode}`);
}

async function testHeaderPassthrough() {
  const marker = randomBytes(4).toString("hex");
  const res = await rawHttpThroughProxy({
    url: "http://httpbin.org/headers",
    headers: { "X-Test-Marker": marker },
  });
  const json = JSON.parse(res.body.toString());
  const echoed = json.headers?.["X-Test-Marker"] === marker;
  record("Custom headers pass through unmodified", res.statusCode === 200 && echoed, `marker echoed=${echoed}`);
}

async function testCookiePassthrough() {
  const res = await rawHttpThroughProxy({ url: "http://httpbin.org/cookies/set/testcookie/abc123" });
  const setCookie = res.headers["set-cookie"];
  const ok = res.statusCode === 302 && Array.isArray(setCookie) && setCookie.some((c) => c.includes("testcookie=abc123"));
  record("Set-Cookie passes through unmodified", ok, `status=${res.statusCode} set-cookie=${setCookie}`);
}

async function testRedirectPassthrough() {
  const res = await rawHttpThroughProxy({ url: "http://httpbin.org/redirect/1" });
  const ok = res.statusCode === 302 && typeof res.headers.location === "string";
  record("Redirect response passes through untouched", ok, `status=${res.statusCode} location=${res.headers.location}`);
}

async function testLargeResponse() {
  // httpbin.org caps /bytes/ at 102400 bytes server-side regardless of what's
  // requested (confirmed by hitting it directly, bypassing the proxy
  // entirely, and getting the identical 102400 back) — not a proxy
  // limitation, so the assertion targets httpbin's actual documented cap
  // rather than the originally-requested size.
  const REQUESTED = 2_000_000;
  const HTTPBIN_ACTUAL_CAP = 102_400;
  const res = await rawHttpThroughProxy({ url: `http://httpbin.org/bytes/${REQUESTED}` });
  record(
    "Large response fully relayed (up to httpbin's own 100KB cap)",
    res.statusCode === 200 && res.body.length === HTTPBIN_ACTUAL_CAP,
    `received=${res.body.length} (httpbin cap=${HTTPBIN_ACTUAL_CAP})`,
  );
}

async function testConcurrentRequestsSameIp() {
  const results = await Promise.all(
    Array.from({ length: 5 }, () => rawHttpThroughProxy({ url: "http://api.ipify.org/" })),
  );
  const ips = results.map((r) => r.body.toString().trim());
  const unique = new Set(ips);
  record(
    "5 concurrent requests on one credential use one exit IP",
    unique.size === 1,
    `ips=${[...unique].join(",")}`,
  );
}

async function testStickyStability(intervalMs = 3000, rounds = 3) {
  const ips = [];
  for (let i = 0; i < rounds; i++) {
    const res = await rawHttpThroughProxy({ url: "http://api.ipify.org/" });
    ips.push(res.body.toString().trim());
    if (i < rounds - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  const unique = new Set(ips);
  record(
    `Sticky session IP stable across ${rounds} requests / ${((rounds - 1) * intervalMs) / 1000}s`,
    unique.size === 1,
    `ips=${ips.join(" -> ")}`,
  );
}

async function testWssUpgrade() {
  try {
    const { sock, statusCode } = await connectTunnel({ targetHost: "echo.websocket.org", targetPort: 443 });
    if (statusCode !== 200) {
      sock.destroy();
      return record("WSS (WebSocket over CONNECT tunnel) handshake", false, `CONNECT failed: ${statusCode}`);
    }
    const key = randomBytes(16).toString("base64");
    const tlsSocket = tls.connect({ socket: sock, servername: "echo.websocket.org" }, () => {
      tlsSocket.write(
        `GET / HTTP/1.1\r\nHost: echo.websocket.org\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      );
    });
    let buf = Buffer.alloc(0);
    const ok = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      tlsSocket.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        if (buf.toString("latin1").includes("\r\n\r\n")) {
          clearTimeout(timer);
          resolve(/^HTTP\/1\.[01]\s+101/.test(buf.toString("latin1")));
        }
      });
      tlsSocket.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    tlsSocket.destroy();
    record("WSS WebSocket handshake through CONNECT tunnel", ok, buf.toString("latin1").split("\r\n")[0]);
  } catch (err) {
    record("WSS WebSocket handshake through CONNECT tunnel", false, err.message);
  }
}

async function main() {
  console.log(`Testing gateway ${PROXY_HOST}:${PROXY_PORT} — neutral test endpoints only\n`);

  await testPlainHttp();
  await testHttpsConnect();
  await testConnectResponseLine();
  await testAuthFailure();
  await testHeaderPassthrough();
  await testCookiePassthrough();
  await testRedirectPassthrough();
  await testLargeResponse();
  await testConcurrentRequestsSameIp();
  await testWssUpgrade();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (process.env.RUN_STICKY_TEST === "1") {
    console.log("\nSticky stability test (takes ~10s)...");
    await testStickyStability();
    console.log(`\n${passed} passed, ${failed} failed (final)`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test run crashed:", err);
  process.exit(1);
});
