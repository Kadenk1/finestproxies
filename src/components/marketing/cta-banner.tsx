import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

export function CtaBanner() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-8 py-16 text-center sm:px-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 60% 60% at 50% 0%, var(--brand-600), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-navy-100/80">
              Create an account, generate proxy credentials, and start
              routing traffic through our gateways in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <LinkButton href="/register" size="lg" className="h-11 px-6 text-[15px]">
                Get Started <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton
                href="/pricing"
                size="lg"
                variant="outline"
                className="h-11 border-white/20 bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
              >
                View Pricing
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
