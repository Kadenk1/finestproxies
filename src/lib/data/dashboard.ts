import { prisma } from "@/lib/db/prisma";
import { bytesToGb } from "@/services/usage/usage-service";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function getDashboardOverview(userId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const chartWindowStart = new Date(now);
  chartWindowStart.setDate(chartWindowStart.getDate() - 13);

  const [balance, productBalances, recentOrders, recentUsage, windowUsage] =
    await Promise.all([
      prisma.customerBalance.findUnique({ where: { userId } }),
      prisma.productBalance.findMany({
        where: { userId },
        include: { product: true },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { include: { product: true } } },
      }),
      prisma.usageRecord.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 8,
        include: { product: true },
      }),
      prisma.usageRecord.findMany({
        where: { userId, occurredAt: { gte: startOfDay(chartWindowStart) } },
        include: { product: true },
      }),
    ]);

  let bandwidthToday = 0n;
  let bandwidthThisMonth = 0n;
  for (const record of windowUsage) {
    if (record.occurredAt >= todayStart) bandwidthToday += record.totalBytes;
    if (record.occurredAt >= monthStart) bandwidthThisMonth += record.totalBytes;
  }

  // Daily bandwidth series (last 14 days)
  const dailyMap = new Map<string, number>();
  const requestsMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(chartWindowStart);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
    requestsMap.set(key, 0);
  }
  for (const record of windowUsage) {
    const key = record.occurredAt.toISOString().slice(0, 10);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + bytesToGb(record.totalBytes));
      requestsMap.set(key, (requestsMap.get(key) ?? 0) + record.requestCount);
    }
  }
  const dailyBandwidth = Array.from(dailyMap.entries()).map(([date, gb]) => ({
    date: date.slice(5),
    gb: Number(gb.toFixed(3)),
  }));
  const dailyRequests = Array.from(requestsMap.entries()).map(([date, count]) => ({
    date: date.slice(5),
    requests: count,
  }));

  // Product usage breakdown (by GB, over the window)
  const productUsageMap = new Map<string, number>();
  for (const record of windowUsage) {
    const name = record.product.name;
    productUsageMap.set(name, (productUsageMap.get(name) ?? 0) + bytesToGb(record.totalBytes));
  }
  const productUsage = Array.from(productUsageMap.entries()).map(([name, gb]) => ({
    name,
    gb: Number(gb.toFixed(3)),
  }));

  return {
    cashBalance: balance ? Number(balance.cashBalance) : 0,
    productBalances,
    recentOrders,
    recentUsage,
    bandwidthTodayGb: bytesToGb(bandwidthToday),
    bandwidthThisMonthGb: bytesToGb(bandwidthThisMonth),
    dailyBandwidth,
    dailyRequests,
    productUsage,
  };
}

export async function getCustomerCredentials(userId: string, productSlug?: string) {
  return prisma.customerProxyCredential.findMany({
    where: {
      userId,
      ...(productSlug ? { product: { slug: productSlug } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { product: true, gateway: true },
  });
}

export async function getUsageHistory(userId: string, limit = 50) {
  return prisma.usageRecord.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { product: true, gateway: true },
  });
}
