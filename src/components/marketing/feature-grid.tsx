import {
  Globe2,
  Pin,
  RefreshCw,
  Lock,
  Terminal,
  Code2,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Globe2,
    title: "Global Coverage",
    description: "Exit nodes across 195 countries so you can target the geography your workload needs.",
  },
  {
    icon: Pin,
    title: "Sticky Sessions",
    description: "Hold the same exit IP for a configurable duration when consistency matters.",
  },
  {
    icon: RefreshCw,
    title: "Rotating Sessions",
    description: "Automatically rotate exit IPs per request or on an interval you control.",
  },
  {
    icon: Lock,
    title: "HTTP/HTTPS Support",
    description: "Standard HTTP and HTTPS proxying compatible with virtually any client library.",
  },
  {
    icon: Terminal,
    title: "SOCKS5 Support",
    description: "Full SOCKS5 support for applications that need protocol-level flexibility.",
  },
  {
    icon: Code2,
    title: "API Access",
    description: "Provision, rotate, and monitor credentials programmatically from your own systems.",
  },
  {
    icon: BarChart3,
    title: "Usage Analytics",
    description: "Real-time bandwidth, request, and cost visibility broken down by product and session.",
  },
  {
    icon: ShieldCheck,
    title: "Reliable Infrastructure",
    description: "Gateways monitored around the clock with automatic failover across upstream capacity.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            Everything a production integration needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built as infrastructure, not a script — so it holds up at scale.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border/70 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-navy-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
