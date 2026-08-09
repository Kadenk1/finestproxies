import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import type { DiscordProfile } from "next-auth/providers/discord";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import type { UserRole } from "@/generated/prisma/enums";
import { isDiscordConfigured } from "@/lib/config/oauth";
import { isDiscordAdmin } from "@/lib/auth/discord-admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";

        const emailLimit = await checkRateLimit(`login:email:${email}`, 8, 15 * 60);
        const ipLimit = await checkRateLimit(`login:ip:${ip}`, 20, 15 * 60);
        if (!emailLimit.allowed || !ipLimit.allowed) {
          await prisma.loginAttempt.create({
            data: { email, ipAddress: ip, success: false },
          });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const passwordValid =
          user?.passwordHash != null
            ? await verifyPassword(password, user.passwordHash)
            : false;

        await prisma.loginAttempt.create({
          data: { email, ipAddress: ip, success: passwordValid },
        });

        if (!user || !passwordValid) return null;
        if (user.status === "SUSPENDED" || user.status === "BANNED") {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastLoginIp: ip },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    ...(isDiscordConfigured
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            // guilds.members.read lets us check server membership + role in
            // the signIn callback below, to auto-grant admin access.
            authorization: { params: { scope: "identify email guilds.members.read" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord") return true; // credentials already fully validated in authorize()

      const discordProfile = profile as DiscordProfile | undefined;
      if (!discordProfile?.email) {
        // Discord account has no verifiable email to link/create a user with.
        return false;
      }

      let dbUser = await prisma.user.findUnique({ where: { discordId: user.id } });

      if (!dbUser) {
        const existingByEmail = await prisma.user.findUnique({
          where: { email: discordProfile.email },
        });

        dbUser = existingByEmail
          ? await prisma.user.update({
              where: { id: existingByEmail.id },
              data: { discordId: user.id, image: user.image ?? existingByEmail.image },
            })
          : await prisma.user.create({
              data: {
                email: discordProfile.email,
                discordId: user.id,
                name: user.name,
                image: user.image,
                role: "CUSTOMER",
                status: discordProfile.verified ? "ACTIVE" : "PENDING_VERIFICATION",
                emailVerifiedAt: discordProfile.verified ? new Date() : null,
                balance: { create: { cashBalance: 0 } },
              },
            });
      }

      if (dbUser.status === "SUSPENDED" || dbUser.status === "BANNED") {
        return false;
      }

      // Auto-promote on every Discord login if they currently hold the
      // configured admin role in the configured server — never auto-demote
      // here, so losing the Discord role doesn't silently lock out an admin
      // who also has credentials-based access; revoke that deliberately
      // from the admin panel instead.
      let role = dbUser.role;
      if (account.access_token && (await isDiscordAdmin(account.access_token))) {
        role = "ADMIN";
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date(), ...(role !== dbUser.role ? { role } : {}) },
      });

      // Stash our DB identity onto `user` so the jwt callback (below) sees it —
      // the OAuth `user` object otherwise only carries the provider profile.
      user.id = dbUser.id;
      user.role = role;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
