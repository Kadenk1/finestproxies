import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily constructed so importing this module is safe even when Stripe isn't configured. */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}
