import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/data/admin";
import { bytesToGb } from "@/services/usage/usage-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerStatusActions } from "@/components/admin/customer-status-actions";
import { AddNoteForm } from "@/components/admin/add-note-form";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  PENDING_VERIFICATION: "secondary",
  SUSPENDED: "destructive",
  BANNED: "destructive",
  DISABLED: "secondary",
  PAID: "default",
  PENDING: "secondary",
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{customer.email}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customer.name} {customer.companyName && `· ${customer.companyName}`} · Joined{" "}
            {customer.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusVariant[customer.status] ?? "secondary"}>{customer.status}</Badge>
          <CustomerStatusActions customerId={customer.id} status={customer.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Cash balance</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              ${Number(customer.balance?.cashBalance ?? 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        {customer.productBalances.map((b) => (
          <Card key={b.id}>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{b.product.name}</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                {b.product.billingUnit === "GB"
                  ? `${bytesToGb(b.remainingBytes).toFixed(2)} GB`
                  : Number(b.remainingUnits).toFixed(0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.orders.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders.</p>
            )}
            {customer.orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {order.items.map((i) => i.product.name).join(", ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">${Number(order.total).toFixed(2)}</span>
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proxy credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.proxyCredentials.length === 0 && (
              <p className="text-sm text-muted-foreground">No credentials generated.</p>
            )}
            {customer.proxyCredentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-foreground">{cred.username}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{cred.product.name}</span>
                  <Badge variant={statusVariant[cred.status] ?? "secondary"}>{cred.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddNoteForm customerId={customer.id} />
          <div className="space-y-3">
            {customer.accountNotes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border/70 bg-secondary/40 p-3 text-sm">
                <p className="text-foreground">{note.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.author.email} · {note.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
