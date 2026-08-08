import { homepageStats } from "@/lib/config/stats";

export function StatsStrip() {
  return (
    <section className="border-y border-border/70 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        {homepageStats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              {stat.value}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
