import { NetworkVisual } from "@/components/marketing/network-visual";

export function NetworkSection() {
  return (
    <section className="bg-section-gradient py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              A global gateway network, monitored end to end
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every session routes through gateways we operate, which select
              the best available upstream capacity by geography, health,
              latency, and cost — with automatic failover if a route
              degrades.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-muted-foreground">Gateway regions</dt>
                <dd className="mt-1 text-2xl font-semibold text-navy-900">12+</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Avg. gateway latency</dt>
                <dd className="mt-1 text-2xl font-semibold text-navy-900">&lt;50ms</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white p-6 card-glow">
            <NetworkVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
