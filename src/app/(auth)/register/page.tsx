import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { DiscordSignInButton } from "@/components/auth/discord-signin-button";
import { isDiscordConfigured } from "@/lib/config/oauth";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-navy-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Get access to residential, ISP, and mobile proxy infrastructure.
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
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/acceptable-use" className="underline underline-offset-2">
          Acceptable Use Policy
        </Link>
        .
      </p>
    </div>
  );
}
