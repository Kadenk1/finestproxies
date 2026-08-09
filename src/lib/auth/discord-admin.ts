const DISCORD_API = "https://discord.com/api/v10";

/**
 * Checks whether the signed-in Discord user holds the configured admin role
 * in the configured server. Requires the `guilds.members.read` OAuth scope
 * (see the Discord provider config in `src/auth.ts`) — without it Discord
 * returns 403 here and this safely resolves to false.
 *
 * DISCORD_ADMIN_SERVER_ID / DISCORD_ADMIN_ROLE_ID are unset by default, so
 * this is a no-op (never grants admin) until both are configured.
 */
export async function isDiscordAdmin(accessToken: string): Promise<boolean> {
  const serverId = process.env.DISCORD_ADMIN_SERVER_ID;
  const roleId = process.env.DISCORD_ADMIN_ROLE_ID;
  if (!serverId || !roleId) return false;

  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds/${serverId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const member = (await res.json()) as { roles?: string[] };
    return Boolean(member.roles?.includes(roleId));
  } catch {
    return false;
  }
}
