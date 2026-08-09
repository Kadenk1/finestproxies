import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { purchaseSchema } from "@/lib/validation/purchase";
import {
  purchaseProduct,
  createStripeCheckoutSession,
  InvalidQuantityError,
  InvalidCouponError,
} from "@/services/billing/order-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isStripeConfigured } from "@/lib/config/stripe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(`purchase:${session.user.id}`, 20, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many purchase attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const order = await purchaseProduct({ userId: session.user.id, ...parsed.data });
    if (isStripeConfigured && order.status === "PENDING") {
      const checkoutUrl = await createStripeCheckoutSession(order.id);
      return NextResponse.json({ order, checkoutUrl }, { status: 201 });
    }
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidQuantityError || err instanceof InvalidCouponError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Purchase failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
