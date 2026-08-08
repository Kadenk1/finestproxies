import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CouponFormDialog } from "@/components/admin/coupon-form-dialog";

const typeLabel: Record<string, string> = {
  PERCENT: "% off",
  FIXED_AMOUNT: "$ off",
  FREE_GB: "Free GB",
};

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">Discount codes for checkout.</p>
        </div>
        <CouponFormDialog />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Redemptions</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id}>
                <TableCell className="font-mono text-sm font-medium text-navy-900">
                  {coupon.code}
                </TableCell>
                <TableCell>
                  {Number(coupon.value)} {typeLabel[coupon.type]}
                </TableCell>
                <TableCell>
                  {coupon.timesRedeemed} / {coupon.maxRedemptions ?? "∞"}
                </TableCell>
                <TableCell>{coupon.expiresAt ? coupon.expiresAt.toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <Badge variant={coupon.active ? "default" : "secondary"}>
                    {coupon.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <CouponFormDialog
                    coupon={{
                      id: coupon.id,
                      code: coupon.code,
                      type: coupon.type,
                      value: Number(coupon.value),
                      maxRedemptions: coupon.maxRedemptions ?? undefined,
                      active: coupon.active,
                      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "",
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
