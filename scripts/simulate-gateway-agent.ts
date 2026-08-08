/**
 * Dev-only stand-in for a real gateway agent. Sends one heartbeat per
 * seeded gateway to the Gateway Control API, demonstrating the same
 * heartbeat contract real gateway infrastructure will use in production.
 *
 * Usage: npm run gateway:heartbeat
 */
import "dotenv/config";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SECRET = process.env.GATEWAY_AGENT_SECRET;

if (!SECRET) {
  console.error("GATEWAY_AGENT_SECRET is not set.");
  process.exit(1);
}

const gateways = [
  { hostname: `resi.${process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? "proxygrid.com"}` },
  { hostname: `isp.${process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? "proxygrid.com"}` },
  { hostname: `mobile.${process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? "proxygrid.com"}` },
];

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

async function sendHeartbeat(hostname: string) {
  const payload = {
    hostname,
    status: "HEALTHY" as const,
    cpuPercent: randomBetween(10, 60),
    memoryPercent: randomBetween(20, 70),
    activeConnections: randomBetween(50, 900),
    bandwidthBps: randomBetween(50_000_000, 900_000_000),
    latencyMs: randomBetween(15, 80),
    uptimeSeconds: randomBetween(100_000, 3_000_000),
  };

  const res = await fetch(`${APP_URL}/api/gateway-control/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error(`[${hostname}] heartbeat failed:`, body.error ?? res.status);
  } else {
    console.log(`[${hostname}] heartbeat ok`, payload);
  }
}

async function main() {
  for (const gateway of gateways) {
    await sendHeartbeat(gateway.hostname);
  }
}

main();
