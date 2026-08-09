import { Prisma } from "@/generated/prisma/client";
import type { PaymentProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { gbToBytes } from "@/services/usage/usage-service";
import { isStripeConfigured } from "@/lib/config/stripe";

export class InvalidQuantityError extends Error {
  constructor(min: number, max: number) {
    super(`Quantity must be between ${min} and ${max}.`);
    this.name = "InvalidQuantityError";
  }
}

export class InvalidCouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCouponError";
  }
}

/**
 * Validates the coupon and atomically claims a redemption slot (the
 * updateMany's WHERE re-checks active/expiry/limit at claim time, so a
 * coupon that gets exhausted or deactivated between the initial lookup and
 * this call is caught rather than over-redeemed).
 */
async function redeemCoupon(code: string, productId: string, subtotal: Prisma.Decimal, unitPrice: Prisma.Decimal) {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    throw new InvalidCouponError("Coupon not found or no longer active.");
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new InvalidCouponError("Coupon has expired.");
  }
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    throw new InvalidCouponError("Coupon has reached its redemption limit.");
  }
  if (coupon.appliesToProductId && coupon.appliesToProductId !== productId) {
    throw new InvalidCouponError("Coupon does not apply to this product.");
  }

  let rawDiscount: Prisma.Decimal;
  switch (coupon.type) {
    case "PERCENT":
      rawDiscount = subtotal.mul(coupon.value).div(100);
      break;
    case "FIXED_AMOUNT":
      rawDiscount = coupon.value;
      break;
    case "FREE_GB":
      rawDiscount = coupon.value.mul(unitPrice);
      break;
  }
  const discount = rawDiscount.greaterThan(subtotal) ? subtotal : rawDiscount;

  const where: Prisma.CouponWhereInput = { id: coupon.id, active: true };
  if (coupon.maxRedemptions != null) {
    where.timesRedeemed = { lt: coupon.maxRedemptions };
  }
  const claimed = await prisma.coupon.updateMany({
    where,
    data: { timesRedeemed: { increment: 1 } },
  });
  if (claimed.count === 0) {
    throw new InvalidCouponError("Coupon is no longer available.");
  }

  return { couponId: coupon.id, discount };
}

/**
 * Creates a PENDING order. Callers decide how it gets paid:
 * - Stripe configured: the API route creates a Checkout Session for this
 *   order next and redirects the customer there; `fulfillStripePayment`
 *   (called only from the webhook, after signature verification) is what
 *   actually credits the balance.
 * - Stripe not configured (local dev): falls back to instantly settling
 *   through the mock provider, same as before Stripe existed.
 */
export async function purchaseProduct(params: {
  userId: string;
  productId: string;
  quantity: number;
  couponCode?: string;
}) {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
  });
  if (!product || !product.active) {
    throw new Error("Product not available.");
  }

  const min = Number(product.minPurchase);
  const max = Number(product.maxPurchase);
  if (params.quantity < min || params.quantity > max) {
    throw new InvalidQuantityError(min, max);
  }

  const unitPrice = product.retailPrice;
  const totalPrice = unitPrice.mul(params.quantity);

  let couponId: string | undefined;
  let discount = new Prisma.Decimal(0);
  if (params.couponCode) {
    const redeemed = await redeemCoupon(params.couponCode, product.id, totalPrice, unitPrice);
    couponId = redeemed.couponId;
    discount = redeemed.discount;
  }
  const total = totalPrice.sub(discount);

  const order = await prisma.order.create({
    data: {
      userId: params.userId,
      status: "PENDING",
      subtotal: totalPrice,
      discount,
      total,
      couponId,
      items: {
        create: [
          {
            productId: product.id,
            quantity: new Prisma.Decimal(params.quantity),
            unitPrice,
            totalPrice,
          },
        ],
      },
    },
  });

  if (!isStripeConfigured) {
    await fulfillMockPayment(order.id);
  }

  return prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: { include: { product: true } }, payments: true },
  });
}

async function fulfillMockPayment(orderId: string) {
  return fulfillPayment({ orderId, provider: "MOCK", idempotencyKey: `mock_${orderId}` });
}

/**
 * Called only from the Stripe webhook handler, only after the event
 * signature has been verified — never from a client-facing request. The
 * Checkout Session id is both the provider payment reference and (prefixed)
 * the idempotency key, so a redelivered webhook event is a safe no-op.
 */
export async function fulfillStripePayment(orderId: string, stripeSessionId: string) {
  return fulfillPayment({
    orderId,
    provider: "STRIPE",
    providerPaymentId: stripeSessionId,
    idempotencyKey: `stripe_${stripeSessionId}`,
  });
}

async function fulfillPayment(params: {
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string;
  idempotencyKey: string;
}) {
  const { orderId, provider, providerPaymentId, idempotencyKey } = params;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  await prisma.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existingPayment) {
      // Already processed — replaying this call must be a no-op.
      return;
    }

    try {
      await tx.payment.create({
        data: {
          orderId,
          provider,
          providerPaymentId,
          idempotencyKey,
          amount: order.total,
          status: "SUCCEEDED",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Lost the race to a concurrent call — the other one will credit.
        return;
      }
      throw err;
    }

    await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });

    for (const item of order.items) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
      const quantity = Number(item.quantity);

      const existingBalance = await tx.productBalance.findUnique({
        where: { userId_productId: { userId: order.userId, productId: item.productId } },
      });

      if (product.billingUnit === "GB") {
        const addBytes = gbToBytes(quantity);
        if (existingBalance) {
          await tx.productBalance.update({
            where: { id: existingBalance.id },
            data: {
              allocatedBytes: existingBalance.allocatedBytes + addBytes,
              remainingBytes: existingBalance.remainingBytes + addBytes,
            },
          });
        } else {
          await tx.productBalance.create({
            data: {
              userId: order.userId,
              productId: item.productId,
              allocatedBytes: addBytes,
              remainingBytes: addBytes,
            },
          });
        }
      } else {
        const addUnits = new Prisma.Decimal(quantity);
        if (existingBalance) {
          await tx.productBalance.update({
            where: { id: existingBalance.id },
            data: {
              allocatedUnits: existingBalance.allocatedUnits.add(addUnits),
              remainingUnits: existingBalance.remainingUnits.add(addUnits),
            },
          });
        } else {
          await tx.productBalance.create({
            data: {
              userId: order.userId,
              productId: item.productId,
              allocatedUnits: addUnits,
              remainingUnits: addUnits,
            },
          });
        }
      }
    }
  });
}

/**
 * Builds a Stripe Checkout Session for a PENDING order and returns its
 * hosted-page URL. One line item per OrderItem, each `quantity: 1` with the
 * OrderItem's already-computed total as the price — sidesteps Stripe's
 * line-item quantity needing to be a whole number, which a fractional GB
 * purchase wouldn't satisfy. The actual balance credit happens later, via
 * the webhook calling `fulfillStripePayment` — never from this call or from
 * the customer's browser landing back on the success URL.
 */
export async function createStripeCheckoutSession(orderId: string) {
  const { getStripeClient } = await import("@/lib/stripe/client");
  const stripe = getStripeClient();

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // purchaseProduct() always creates exactly one OrderItem — charging
  // order.total as a single line item (rather than summing each item's
  // pre-discount totalPrice) is what makes a coupon's discount actually
  // reduce what Stripe collects, instead of just reducing what gets
  // recorded internally while the customer's card is charged full price.
  const item = order.items[0];
  const description =
    order.items.length === 1
      ? `${item.product.name} — ${Number(item.quantity)} ${item.product.billingUnit}`
      : `${order.items.length} items`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: order.user.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(order.total) * 100),
            product_data: { name: description },
          },
        },
      ],
      success_url: `${appUrl}/dashboard/orders?stripe=success`,
      cancel_url: `${appUrl}/dashboard/orders?stripe=cancel`,
    },
    { idempotencyKey: `checkout_${order.id}` },
  );

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }

  return session.url;
}

export async function getOrderHistory(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, payments: true },
  });
}

export async function getCustomerBalanceSummary(userId: string) {
  const [cashBalance, productBalances] = await Promise.all([
    prisma.customerBalance.findUnique({ where: { userId } }),
    prisma.productBalance.findMany({
      where: { userId },
      include: { product: true },
    }),
  ]);
  return { cashBalance, productBalances };
}
