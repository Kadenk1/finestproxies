import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { encryptSecret } from "../src/lib/crypto/secrets";
import { gatewayHosts } from "../src/lib/config/brand";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = "DevPassword123";

async function seedUsers() {
  const adminPasswordHash = await hashPassword(DEV_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: "admin@proxygrid.com" },
    update: {},
    create: {
      email: "admin@proxygrid.com",
      passwordHash: adminPasswordHash,
      name: "Ada Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  const customerPasswordHash = await hashPassword(DEV_PASSWORD);
  const customer = await prisma.user.upsert({
    where: { email: "customer@proxygrid.com" },
    update: {},
    create: {
      email: "customer@proxygrid.com",
      passwordHash: customerPasswordHash,
      name: "Casey Customer",
      companyName: "Acme Data Co.",
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      balance: { create: { cashBalance: 42.5 } },
    },
  });

  return { admin, customer };
}

async function seedProducts() {
  const residential = await prisma.product.upsert({
    where: { slug: "residential" },
    update: {},
    create: {
      name: "Residential Proxies",
      slug: "residential",
      type: "RESIDENTIAL",
      description:
        "Rotating and sticky residential IPs sourced from real consumer devices, routed through our gateways.",
      active: true,
      billingUnit: "GB",
      retailPrice: 3.0,
      internalCostEstimate: 0.8,
      minPurchase: 1,
      maxPurchase: 5000,
      sortOrder: 1,
      locations: {
        create: [
          { country: "US" },
          { country: "GB" },
          { country: "DE" },
          { country: "CA" },
          { country: "AU" },
          { country: "FR" },
          { country: "JP" },
          { country: "BR" },
        ],
      },
    },
  });

  const isp = await prisma.product.upsert({
    where: { slug: "isp" },
    update: {},
    create: {
      name: "ISP Proxies",
      slug: "isp",
      type: "ISP",
      description:
        "Static datacenter-speed IPs registered to real ISPs for high trust and consistent performance.",
      active: true,
      billingUnit: "IP_MONTH",
      retailPrice: 4.5,
      internalCostEstimate: 1.5,
      minPurchase: 1,
      maxPurchase: 1000,
      sortOrder: 2,
      locations: {
        create: [
          { country: "US" },
          { country: "GB" },
          { country: "DE" },
          { country: "CA" },
        ],
      },
    },
  });

  const mobile = await prisma.product.upsert({
    where: { slug: "mobile" },
    update: {},
    create: {
      name: "Mobile Proxies",
      slug: "mobile",
      type: "MOBILE",
      description:
        "4G/5G carrier IPs with rotating sessions, ideal for the highest trust requirements.",
      active: true,
      billingUnit: "GB",
      retailPrice: 6.0,
      internalCostEstimate: 2.2,
      minPurchase: 1,
      maxPurchase: 2000,
      sortOrder: 3,
      locations: {
        create: [{ country: "US" }, { country: "GB" }, { country: "DE" }],
      },
    },
  });

  await prisma.plan.upsert({
    where: { slug: "isp-50-monthly" },
    update: {},
    create: {
      productId: isp.id,
      name: "50 IPs / month",
      slug: "isp-50-monthly",
      billingInterval: "MONTHLY",
      price: 200,
      unitAllowance: 50,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "mobile-100gb-monthly" },
    update: {},
    create: {
      productId: mobile.id,
      name: "100 GB / month",
      slug: "mobile-100gb-monthly",
      billingInterval: "MONTHLY",
      price: 550,
      unitAllowance: 100,
    },
  });

  return { residential, isp, mobile };
}

async function seedProvider(productIds: {
  residential: string;
  isp: string;
  mobile: string;
}) {
  const provider = await prisma.provider.upsert({
    where: { slug: "mock-provider" },
    update: {},
    create: {
      name: "Mock Upstream Provider",
      slug: "mock-provider",
      enabled: true,
      priority: 10,
      weight: 100,
      apiBaseUrl: "https://mock-provider.internal",
      notes: "Development-only simulated upstream. See MOCK_PROVIDER adapter.",
      healthStatus: "HEALTHY",
      currentLatencyMs: 42,
      successRatePercent: 99.2,
      monthlyUsageBytes: 1_200_000_000_000n,
      monthlyCost: 960,
      lastHealthCheckAt: new Date(),
      credentials: {
        create: [
          {
            type: "API_KEY",
            label: "Primary API key",
            encryptedValue: encryptSecret("mock-provider-dev-api-key"),
          },
        ],
      },
      products: {
        create: [
          { productId: productIds.residential, costPerGb: 0.8 },
          { productId: productIds.isp, costPerIp: 1.5 },
          { productId: productIds.mobile, costPerGb: 2.2 },
        ],
      },
      locations: {
        create: [
          { country: "US", capacityScore: 100, priority: 10 },
          { country: "GB", capacityScore: 90, priority: 10 },
          { country: "DE", capacityScore: 85, priority: 20 },
          { country: "CA", capacityScore: 80, priority: 20 },
          { country: "AU", capacityScore: 70, priority: 30 },
          { country: "FR", capacityScore: 75, priority: 30 },
          { country: "JP", capacityScore: 65, priority: 30 },
          { country: "BR", capacityScore: 60, priority: 40 },
        ],
      },
    },
  });

  return provider;
}

async function seedGateways(
  providerId: string,
  productIds: { residential: string; isp: string; mobile: string },
) {
  const gateways = await Promise.all([
    prisma.gateway.upsert({
      where: { hostname: gatewayHosts.residential },
      update: {},
      create: {
        name: "Residential Gateway 1",
        hostname: gatewayHosts.residential,
        ipAddress: "203.0.113.10",
        region: "us-east",
        status: "HEALTHY",
        cpuPercent: 24.5,
        memoryPercent: 41.2,
        activeConnections: 812,
        bandwidthBps: 850_000_000n,
        latencyMs: 38,
        uptimeSeconds: 2_592_000n,
        lastHeartbeatAt: new Date(),
      },
    }),
    prisma.gateway.upsert({
      where: { hostname: gatewayHosts.isp },
      update: {},
      create: {
        name: "ISP Gateway 1",
        hostname: gatewayHosts.isp,
        ipAddress: "203.0.113.20",
        region: "us-east",
        status: "HEALTHY",
        cpuPercent: 18.1,
        memoryPercent: 33.9,
        activeConnections: 240,
        bandwidthBps: 420_000_000n,
        latencyMs: 22,
        uptimeSeconds: 3_110_400n,
        lastHeartbeatAt: new Date(),
      },
    }),
    prisma.gateway.upsert({
      where: { hostname: gatewayHosts.mobile },
      update: {},
      create: {
        name: "Mobile Gateway 1",
        hostname: gatewayHosts.mobile,
        ipAddress: "203.0.113.30",
        region: "eu-west",
        status: "DEGRADED",
        cpuPercent: 71.3,
        memoryPercent: 68.4,
        activeConnections: 95,
        bandwidthBps: 110_000_000n,
        latencyMs: 96,
        uptimeSeconds: 950_400n,
        lastHeartbeatAt: new Date(),
      },
    }),
  ]);

  const [resiGw, ispGw, mobileGw] = gateways;

  await prisma.gatewayRoute.upsert({
    where: {
      gatewayId_providerId_productId: {
        gatewayId: resiGw.id,
        providerId,
        productId: productIds.residential,
      },
    },
    update: {},
    create: {
      gatewayId: resiGw.id,
      providerId,
      productId: productIds.residential,
      priority: 10,
      weight: 100,
    },
  });

  await prisma.gatewayRoute.upsert({
    where: {
      gatewayId_providerId_productId: {
        gatewayId: ispGw.id,
        providerId,
        productId: productIds.isp,
      },
    },
    update: {},
    create: {
      gatewayId: ispGw.id,
      providerId,
      productId: productIds.isp,
      priority: 10,
      weight: 100,
    },
  });

  await prisma.gatewayRoute.upsert({
    where: {
      gatewayId_providerId_productId: {
        gatewayId: mobileGw.id,
        providerId,
        productId: productIds.mobile,
      },
    },
    update: {},
    create: {
      gatewayId: mobileGw.id,
      providerId,
      productId: productIds.mobile,
      priority: 10,
      weight: 100,
    },
  });

  return { resiGw, ispGw, mobileGw };
}

async function seedCoupon() {
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      type: "PERCENT",
      value: 10,
      maxRedemptions: 500,
      active: true,
    },
  });
}

async function seedCustomerActivity(
  customerId: string,
  productIds: { residential: string; isp: string; mobile: string },
  providerId: string,
  gatewayIds: { resi: string; isp: string; mobile: string },
) {
  await prisma.productBalance.upsert({
    where: { userId_productId: { userId: customerId, productId: productIds.residential } },
    update: {},
    create: {
      userId: customerId,
      productId: productIds.residential,
      allocatedBytes: 10n * 1024n * 1024n * 1024n,
      remainingBytes: 8_630_000_000n,
    },
  });

  await prisma.productBalance.upsert({
    where: { userId_productId: { userId: customerId, productId: productIds.mobile } },
    update: {},
    create: {
      userId: customerId,
      productId: productIds.mobile,
      allocatedBytes: 5n * 1024n * 1024n * 1024n,
      remainingBytes: 5n * 1024n * 1024n * 1024n,
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: customerId,
      status: "PAID",
      subtotal: 30,
      discount: 0,
      total: 30,
      items: {
        create: [
          {
            productId: productIds.residential,
            quantity: 10,
            unitPrice: 3,
            totalPrice: 30,
          },
        ],
      },
      payments: {
        create: [
          {
            provider: "MOCK",
            idempotencyKey: `seed-order-${customerId}-1`,
            amount: 30,
            status: "SUCCEEDED",
          },
        ],
      },
    },
  });

  const credential = await prisma.customerProxyCredential.upsert({
    where: { username: "cg_demo_user" },
    update: {},
    create: {
      userId: customerId,
      productId: productIds.residential,
      gatewayId: gatewayIds.resi,
      label: "Demo residential credential",
      username: "cg_demo_user",
      passwordEnc: encryptSecret("demo-pass-do-not-use"),
      protocol: "HTTP",
      sessionType: "ROTATING",
      country: "US",
    },
  });

  await prisma.usageRecord.upsert({
    where: { dedupeKey: `seed-usage-${customerId}-1` },
    update: {},
    create: {
      userId: customerId,
      productId: productIds.residential,
      gatewayId: gatewayIds.resi,
      providerId,
      credentialId: credential.id,
      dedupeKey: `seed-usage-${customerId}-1`,
      bytesUploaded: 120_000_000n,
      bytesDownloaded: 1_250_000_000n,
      totalBytes: 1_370_000_000n,
      requestCount: 4213,
      occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  });

  return order;
}

async function main() {
  console.log("Seeding database...");
  const { customer } = await seedUsers();
  const { residential, isp, mobile } = await seedProducts();
  const productIds = { residential: residential.id, isp: isp.id, mobile: mobile.id };
  const provider = await seedProvider(productIds);
  const { resiGw, ispGw, mobileGw } = await seedGateways(provider.id, productIds);
  await seedCoupon();
  await seedCustomerActivity(customer.id, productIds, provider.id, {
    resi: resiGw.id,
    isp: ispGw.id,
    mobile: mobileGw.id,
  });
  console.log("Seed complete.");
  console.log("  Admin login:    admin@proxygrid.com / DevPassword123");
  console.log("  Customer login: customer@proxygrid.com / DevPassword123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
