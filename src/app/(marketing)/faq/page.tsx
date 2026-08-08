import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "FAQ" };

const faqGroups = [
  {
    heading: "Getting started",
    items: [
      {
        q: "How do I get proxy credentials?",
        a: "After creating an account and purchasing a product, open the Proxy Generator in your dashboard, choose product, location, protocol, and session type, then generate credentials scoped to our gateways.",
      },
      {
        q: "Which protocols do you support?",
        a: "HTTP, HTTPS, and SOCKS5 are supported across all products.",
      },
      {
        q: "Can I use my own tools and scripts?",
        a: `Yes — credentials work with any HTTP/HTTPS or SOCKS5-compatible client, including cURL, Python's requests, Node.js, and most scraping or automation frameworks. See our Documentation page for examples.`,
      },
    ],
  },
  {
    heading: "Billing & usage",
    items: [
      {
        q: "How is usage measured?",
        a: "We meter bytes uploaded and downloaded through your credentials in real time and deduct from your product balance. Your dashboard always reflects current remaining balance.",
      },
      {
        q: "What happens when my balance runs out?",
        a: "Once a product's allocation reaches zero, further requests through that product's credentials are blocked until you top up or your recurring plan renews.",
      },
      {
        q: "Do you offer refunds?",
        a: "Reach out to support with your order details — we review refund requests on a case-by-case basis in line with our Terms of Service.",
      },
    ],
  },
  {
    heading: "Network & reliability",
    items: [
      {
        q: `Do I connect directly to upstream providers?`,
        a: `No. You always connect through ${brand.name}'s own gateway hostnames. We handle upstream provider selection, health checks, and failover behind the scenes — upstream credentials are never exposed to customers.`,
      },
      {
        q: "What happens if a gateway degrades?",
        a: "Our routing engine continuously scores gateway and upstream health and automatically shifts traffic away from degraded capacity.",
      },
    ],
  },
  {
    heading: "Acceptable use",
    items: [
      {
        q: "What activities are prohibited?",
        a: "Illegal activity, unauthorized access, credential attacks, fraud, spam, malware distribution, and attempts to bypass third-party access controls are all prohibited. See our full Acceptable Use Policy for details.",
      },
      {
        q: "What happens if my account is flagged for abuse?",
        a: "Depending on severity, we may rate-limit, suspend credentials, or suspend the account while we investigate, per our Acceptable Use Policy.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">
          Frequently asked questions
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link href="/contact" className="text-brand-700 underline underline-offset-2">
            Contact support
          </Link>
          .
        </p>
      </div>

      <div className="mt-14 space-y-10">
        {faqGroups.map((group) => (
          <div key={group.heading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              {group.heading}
            </h2>
            <Accordion className="mt-3">
              {group.items.map((item) => (
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
        ))}
      </div>
    </div>
  );
}
