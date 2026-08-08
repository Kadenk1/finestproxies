/**
 * Whether Discord OAuth is configured. The Discord provider is only added
 * to NextAuth (and the "Continue with Discord" button only rendered) when
 * both values are present — a missing clientId/clientSecret would otherwise
 * either break every auth route or silently fail at the Discord consent
 * screen.
 */
export const isDiscordConfigured = Boolean(
  process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
);
