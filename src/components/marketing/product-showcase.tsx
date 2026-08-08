import { ArrowRight, Router, Smartphone, Users } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

const products = [
  {
    icon: Users,
    name: "Residential Proxies",
    description:
      "Rotating and sticky IPs sourced from real residential devices across the globe. Ideal for high-scale data collection that needs to blend in.",
    points: ["195 countries", "Rotating or sticky sessions", "Billed per GB"],
    href: "/pricing#residential",
  },
  {
    icon: Router,
    name: "ISP Proxies",
    description:
      "Static IPs registered to real internet service providers, combining datacenter speed with residential-grade trust.",
    points: ["Datacenter-class speed", "Dedicated static IPs", "Billed per IP/month"],
    href: "/pricing#isp",
  },
  {
    icon: Smartphone,
    name: "Mobile Proxies",
    description:
      "Carrier-grade 4G/5G IPs with rotating sessions for the highest trust requirements and the toughest targets.",
    points: ["Real carrier networks", "Rotating sessions", "Billed per GB or port/month"],
    href: "/pricing#mobile",
  },
];

export function ProductShowcase() {
  return (
    <section id="products" className="bg-section-gradient py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            One platform, three proxy networks
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every product routes through infrastructure we control — so you
            get one integration, one dashboard, and one bill.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.name}
              className="card-glow flex flex-col rounded-2xl border border-border/70 bg-white p-7"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <product.icon className="h-5.5 w-5.5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy-900">
                {product.name}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
              <ul className="mt-5 space-y-2">
                {product.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-2 text-sm text-navy-700"
                  >
                    <span className="h-1 w-1 rounded-full bg-brand-500" />
                    {point}
                  </li>
                ))}
              </ul>
              <LinkButton
                href={product.href}
                variant="ghost"
                className="group mt-6 justify-start px-0 text-brand-700 hover:bg-transparent"
              >
                View pricing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </LinkButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
