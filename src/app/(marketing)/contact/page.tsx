import type { Metadata } from "next";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Contact" };

const channels = [
  {
    icon: MessageCircle,
    title: "General & sales",
    description: "Questions about products, pricing, or getting started.",
    value: brand.supportEmail,
  },
  {
    icon: Mail,
    title: "Support",
    description: "Existing customers — for fastest response, open a ticket from your dashboard.",
    value: brand.supportEmail,
  },
  {
    icon: ShieldAlert,
    title: "Abuse & legal",
    description: "Report Acceptable Use Policy violations or legal inquiries.",
    value: brand.legalEmail,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">
          Get in touch
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Have a question about {brand.name}? Send us a message and we&apos;ll
          respond as soon as we can.
        </p>
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-5">
          {channels.map((channel) => (
            <div key={channel.title} className="rounded-2xl border border-border/70 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <channel.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-navy-900">{channel.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{channel.description}</p>
              <p className="mt-2 text-sm font-medium text-brand-700">{channel.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-white p-8">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
