import Link from "next/link";
import { getCustomers } from "@/lib/data/admin";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  PENDING_VERIFICATION: "secondary",
  SUSPENDED: "destructive",
  BANNED: "destructive",
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await getCustomers(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{customers.length} customers</p>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Search by email, name, or company..." />
      </form>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {customer.email}
                  </Link>
                </TableCell>
                <TableCell>{customer.name ?? "—"}</TableCell>
                <TableCell>${Number(customer.balance?.cashBalance ?? 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[customer.status] ?? "secondary"}>
                    {customer.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {customer.createdAt.toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
