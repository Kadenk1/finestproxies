import { Check } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

const billingUnitLabel: Record<string, string> = {
  GB: "/ GB",
  IP_MONTH: "/ IP / month",
  PORT_MONTH: "/ port / month",
  FLAT: "",
};

interface PricingCardProps {
  id?: string;
  name: string;
  description: string | null;
  price: string;
  billingUnit: string;
  features: string[];
  plans?: { name: string; price: string; unitAllowance: string }[];
  featured?: boolean;
}

export function PricingCard({
  id,
  name,
  description,
  price,
  billingUnit,
  features,
  plans,
  featured,
}: PricingCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col rounded-2xl border p-8",
        featured
          ? "border-brand-300 bg-white card-glow ring-1 ring-brand-200"
          : "border-border/70 bg-white",
      )}
    >
      <h3 className="text-lg font-semibold text-navy-900">{name}</h3>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-navy-900">
          ${price}
        </span>
        <span className="text-sm text-muted-foreground">
          {billingUnitLabel[billingUnit] ?? ""}
        </span>
      </div>

      <ul className="mt-6 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-navy-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {feature}
          </li>
        ))}
      </ul>

      {plans && plans.length > 0 && (
        <div className="mt-6 space-y-2 rounded-xl bg-secondary/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            Monthly plans
          </p>
          {plans.map((plan) => (
            <div key={plan.name} className="flex items-center justify-between text-sm">
              <span className="text-navy-700">{plan.name}</span>
              <span className="font-medium text-navy-900">${plan.price}/mo</span>
            </div>
          ))}
        </div>
      )}

      <LinkButton href="/register" className="mt-8" variant={featured ? "default" : "outline"}>
        Get Started
      </LinkButton>
    </div>
  );
}
