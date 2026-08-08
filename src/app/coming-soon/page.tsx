import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { SitePasswordForm } from "@/components/gate/site-password-form";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Coming soon" };

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-hero-gradient px-4 py-16">
      <div className="flex items-center gap-2 font-semibold">
        <Logo className="h-9 w-9" />
        <span className="text-base tracking-tight text-navy-900">{brand.name}</span>
      </div>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-border/70 bg-white p-8 text-center card-glow">
        <h1 className="text-xl font-semibold text-navy-900">We&apos;re getting ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {brand.name} is putting the finishing touches on things before
          launch. If you have the access password, you can preview the site
          now.
        </p>
        <div className="mt-6">
          <Suspense>
            <SitePasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
