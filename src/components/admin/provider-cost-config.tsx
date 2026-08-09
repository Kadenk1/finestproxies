"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CostRow {
  productId: string;
  productName: string;
  billingUnit: string;
  costPerGb: number | null;
  costPerIp: number | null;
  costPerPort: number | null;
}

export function ProviderCostConfig({
  providerId,
  rows: initialRows,
}: {
  providerId: string;
  rows: CostRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateRow(productId: string, field: keyof CostRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, [field]: value === "" ? null : Number(value) } : r)),
    );
  }

  async function save(row: CostRow) {
    setSavingId(row.productId);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          costPerGb: row.costPerGb ?? undefined,
          costPerIp: row.costPerIp ?? undefined,
          costPerPort: row.costPerPort ?? undefined,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save cost config.");
        return;
      }
      toast.success(`Cost updated for ${row.productName}.`);
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Cost / GB</TableHead>
          <TableHead>Cost / IP</TableHead>
          <TableHead>Cost / port</TableHead>
          <TableHead className="text-right">Save</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell className="font-medium text-foreground">{row.productName}</TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.0001"
                className="h-8 w-24"
                value={row.costPerGb ?? ""}
                onChange={(e) => updateRow(row.productId, "costPerGb", e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.0001"
                className="h-8 w-24"
                value={row.costPerIp ?? ""}
                onChange={(e) => updateRow(row.productId, "costPerIp", e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.0001"
                className="h-8 w-24"
                value={row.costPerPort ?? ""}
                onChange={(e) => updateRow(row.productId, "costPerPort", e.target.value)}
              />
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={savingId === row.productId}
                onClick={() => save(row)}
              >
                Save
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
