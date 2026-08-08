import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import type { UserRole } from "@/generated/prisma/enums";

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
        const passwordValid = user
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
  ],
  callbacks: {
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
