import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCustomerCredentials } from "@/lib/data/dashboard";
import { CredentialList, type CredentialRow } from "@/components/dashboard/credential-list";
import { LinkButton } from "@/components/ui/link-button";

const productMeta: Record<string, { name: string }> = {
  residential: { name: "Residential Proxies" },
  isp: { name: "ISP Proxies" },
  mobile: { name: "Mobile Proxies" },
};

export default async function ProxiesByProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = await params;
  const meta = productMeta[product];
  if (!meta) notFound();

  const session = await auth();
  const credentials = await getCustomerCredentials(session!.user.id, product);

  const rows: CredentialRow[] = credentials.map((c) => ({
    id: c.id,
    username: c.username,
    protocol: c.protocol,
    sessionType: c.sessionType,
    country: c.country,
    status: c.status,
    gatewayName: c.gateway.name,
    createdAt: c.createdAt.toISOString(),
    lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">{meta.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Credentials generated for this product, routed through our gateways.
          </p>
        </div>
        <LinkButton href="/dashboard/proxy-generator">Generate new</LinkButton>
      </div>
      <CredentialList initialRows={rows} />
    </div>
  );
}
