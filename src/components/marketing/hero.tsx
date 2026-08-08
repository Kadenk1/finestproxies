import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

const highlights = [
  "Residential, ISP & mobile IPs",
  "Our own gateway infrastructure",
  "HTTP/HTTPS & SOCKS5 support",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero-gradient">
      <div className="pointer-events-none absolute inset-0 grid-fade-mask">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(var(--brand-200) 1px, transparent 1px), linear-gradient(90deg, var(--brand-200) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-20 text-center sm:px-6 sm:pt-32 sm:pb-28 lg:px-8">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-brand-700 shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Proxy infrastructure, engineered for reliability
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl md:text-6xl">
          Premium Proxy Infrastructure{" "}
          <span className="text-gradient-brand">Built for Performance</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
          Access residential, ISP, and mobile proxy infrastructure through one
          platform — routed through gateways we own and operate, with the
          reliability, coverage, and observability production teams need.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/register" size="lg" className="h-11 px-6 text-[15px]">
            Get Started <ArrowRight className="h-4 w-4" />
          </LinkButton>
          <LinkButton
            href="/pricing"
            size="lg"
            variant="outline"
            className="h-11 px-6 text-[15px]"
          >
            View Pricing
          </LinkButton>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {highlights.map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-sm text-navy-600">
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
