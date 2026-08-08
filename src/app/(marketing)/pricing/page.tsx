import type { Metadata } from "next";
import { getActiveProductsWithPlans } from "@/lib/data/products";
import { PricingCard } from "@/components/marketing/pricing-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const featuresByType: Record<string, (locationCount: number) => string[]> = {
  RESIDENTIAL: (n) => [
    `${n}+ countries available`,
    "Rotating & sticky sessions",
    "HTTP/HTTPS & SOCKS5",
    "Pay only for what you use",
  ],
  ISP: (n) => [
    `${n}+ countries available`,
    "Dedicated static IPs",
    "Datacenter-class speed",
    "HTTP/HTTPS & SOCKS5",
  ],
  MOBILE: (n) => [
    `${n}+ countries available`,
    "Real 4G/5G carrier IPs",
    "Rotating sessions",
    "Highest trust tier",
  ],
};

const faqs = [
  {
    q: "How does GB-based billing work?",
    a: "You purchase a bandwidth allowance and we meter bytes uploaded and downloaded through your credentials in real time. Your remaining balance is visible in the dashboard at all times.",
  },
  {
    q: "Can I mix products on one account?",
    a: "Yes. Residential, ISP, and mobile balances are tracked independently, and you can generate credentials for any product you've purchased from the same dashboard.",
  },
  {
    q: "Do unused GBs expire?",
    a: "One-time GB purchases don't expire. Recurring ISP/mobile plans renew their allowance each billing period per your plan terms.",
  },
  {
    q: "Is there a minimum commitment?",
    a: "No. Residential and mobile GB purchases and ISP IP allocations are available without a long-term contract.",
  },
];

export default async function PricingPage() {
  const products = await getActiveProductsWithPlans();

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">
          Simple, usage-based pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Pay for what you use — no hidden fees, no long-term contracts.
          Pricing shown here is pulled live from our platform.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {products.map((product) => (
          <PricingCard
            key={product.id}
            id={product.slug}
            name={product.name}
            description={product.description}
            price={Number(product.retailPrice).toFixed(2)}
            billingUnit={product.billingUnit}
            featured={product.type === "RESIDENTIAL"}
            features={
              featuresByType[product.type]?.(product.locations.length) ?? []
            }
            plans={product.plans.map((plan) => ({
              name: plan.name,
              price: Number(plan.price).toFixed(2),
              unitAllowance: plan.unitAllowance.toString(),
            }))}
          />
        ))}
      </div>

      <div className="mx-auto mt-24 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-navy-900">
          Pricing questions
        </h2>
        <Accordion className="mt-8">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left text-[15px] font-medium text-navy-900">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
