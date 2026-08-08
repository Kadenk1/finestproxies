import { prisma } from "@/lib/db/prisma";
import { bytesToGb } from "@/services/usage/usage-service";

export async function getAdminOverview() {
  const [
    customerCount,
    activeCustomerCount,
    totalRevenue,
    totalUsageBytes,
    gatewayStatusCounts,
    providerStatusCounts,
    recentOrders,
    recentSignups,
    openTickets,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
    prisma.usageRecord.aggregate({ _sum: { totalBytes: true } }),
    prisma.gateway.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.provider.groupBy({ by: ["healthStatus"], _count: { _all: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: true, items: { include: { product: true } } },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
  ]);

  return {
    customerCount,
    activeCustomerCount,
    totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    totalUsageGb: bytesToGb(totalUsageBytes._sum.totalBytes ?? 0n),
    gatewayStatusCounts,
    providerStatusCounts,
    recentOrders,
    recentSignups,
    openTickets,
  };
}

export async function getCustomers(search?: string) {
  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { balance: true },
  });
}

export async function getCustomerDetail(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    include: {
      balance: true,
      productBalances: { include: { product: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { items: { include: { product: true } } },
      },
      proxyCredentials: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { product: true, gateway: true },
      },
      accountNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: true },
      },
      abuseReports: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getRevenueByProduct() {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: "PAID" } },
    include: { product: true },
  });
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.product.name, (map.get(item.product.name) ?? 0) + Number(item.totalPrice));
  }
  return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue }));
}
