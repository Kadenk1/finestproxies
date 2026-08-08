/**
 * Auth for the Gateway Control API's ingestion endpoints (heartbeat, usage).
 * These are called by gateway agents, not browsers — a shared bearer
 * secret, not a user session.
 *
 * TODO(production): replace the single shared secret with a per-gateway
 * credential (e.g. a token minted when the gateway is registered, stored
 * hashed) so a compromised agent can be revoked individually instead of
 * rotating one secret for the whole fleet.
 */
export function isAuthorizedGatewayAgent(request: Request): boolean {
  const expected = process.env.GATEWAY_AGENT_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token === expected;
}
