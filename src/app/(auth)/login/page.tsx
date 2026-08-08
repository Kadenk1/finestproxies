import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { DiscordSignInButton } from "@/components/auth/discord-signin-button";
import { isDiscordConfigured } from "@/lib/config/oauth";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-navy-900">Log in</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Welcome back. Enter your credentials to continue.
      </p>

      {isDiscordConfigured && (
        <div className="mt-6">
          <Suspense>
            <DiscordSignInButton />
          </Suspense>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <div className={isDiscordConfigured ? "" : "mt-6"}>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
