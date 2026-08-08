import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { gbToBytes } from "@/services/usage/usage-service";

export class InvalidQuantityError extends Error {
  constructor(min: number, max: number) {
    super(`Quantity must be between ${min} and ${max}.`);
    this.name = "InvalidQuantityError";
  }
}

/**
 * Creates an order and immediately settles it through the mock payment
 * provider. This stands in for a real checkout (Phase 5 wires up Stripe)
 * but is deliberately structured the same way a real integration must be:
 * the order is created PENDING, and only a server-side confirmation step
 * (`fulfillMockPayment`, standing in for a verified webhook) ever credits
 * the customer's balance — never the initial request itself.
 */
export async function purchaseProduct(params: {
  userId: string;
  productId: string;
  quantity: number;
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

  const order = await prisma.order.create({
    data: {
      userId: params.userId,
      status: "PENDING",
      subtotal: totalPrice,
      total: totalPrice,
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

  await fulfillMockPayment(order.id);

  return prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: { include: { product: true } }, payments: true },
  });
}

/**
 * TODO(production): replace this direct call with a Stripe webhook handler
 * that verifies the event signature before calling the same crediting
 * logic. The idempotency shape (unique `idempotencyKey`, credit only on
 * first successful insert) is intentionally identical so that swap is a
 * transport-layer change, not a logic change.
 */
async function fulfillMockPayment(orderId: string) {
  const idempotencyKey = `mock_${orderId}`;

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
          provider: "MOCK",
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
