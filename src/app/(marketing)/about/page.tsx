import type { Metadata } from "next";
import { Server, ShieldCheck, Gauge, Users2 } from "lucide-react";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "About" };

const values = [
  {
    icon: Server,
    title: "We own our gateways",
    description:
      "Every session routes through infrastructure we operate end to end — not a reseller's black box. That's what lets us guarantee consistent performance and give you real observability.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance first",
    description:
      "We work only with authorized upstream sources and require every customer to agree to an Acceptable Use Policy that prohibits illegal and abusive activity.",
  },
  {
    icon: Gauge,
    title: "Built for reliability",
    description:
      "Our routing engine continuously scores upstream health, latency, and success rate so traffic automatically fails over away from degraded capacity.",
  },
  {
    icon: Users2,
    title: "Support that understands infrastructure",
    description:
      "Our team operates the network we sell — when you open a ticket, you're talking to people who can see the same metrics you can.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">
          Infrastructure, not middleman software
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {brand.name} was built on a simple premise: proxy access should be
          as reliable, observable, and well-engineered as any other piece of
          production infrastructure.
        </p>
      </div>

      <div className="mt-16 space-y-6 text-[15px] leading-relaxed text-navy-700">
        <p>
          Most proxy providers are thin resale layers in front of someone
          else&apos;s network, with little visibility into what&apos;s
          actually happening underneath. We took a different approach: build
          our own gateway layer, put real monitoring behind it, and give
          customers a dashboard that reflects what&apos;s actually going on —
          not just what a reseller API happens to expose.
        </p>
        <p>
          That gateway layer is also what lets us support multiple upstream
          providers behind the scenes without customers ever needing to know
          or care. If one upstream source degrades, our routing engine can
          shift traffic to another without you changing a single line of
          integration code.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {values.map((value) => (
          <div key={value.title} className="rounded-2xl border border-border/70 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <value.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-navy-900">{value.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {value.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
