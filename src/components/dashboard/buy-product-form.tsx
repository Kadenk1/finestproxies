"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BuyableProduct {
  id: string;
  name: string;
  slug: string;
  retailPrice: number;
  billingUnit: "GB" | "IP_MONTH" | "PORT_MONTH" | "FLAT";
  minPurchase: number;
  maxPurchase: number;
}

const unitNoun: Record<BuyableProduct["billingUnit"], string> = {
  GB: "GB",
  IP_MONTH: "IPs",
  PORT_MONTH: "ports",
  FLAT: "units",
};

export function BuyProductForm({ products }: { products: BuyableProduct[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(products[0]?.minPurchase ?? 1);
  const [couponCode, setCouponCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = products.find((p) => p.id === productId);
  const total = product ? product.retailPrice * quantity : 0;

  async function handleBuy() {
    if (!product) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity, couponCode: couponCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Purchase failed.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      const discount = Number(data.order?.discount ?? 0);
      toast.success(
        discount > 0
          ? `Purchased ${quantity} ${unitNoun[product.billingUnit]} of ${product.name} — coupon saved $${discount.toFixed(2)}.`
          : `Purchased ${quantity} ${unitNoun[product.billingUnit]} of ${product.name}.`,
      );
      setCouponCode("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0) return null;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Product</Label>
          <Select
            value={productId}
            onValueChange={(v) => {
              if (!v) return;
              setProductId(v);
              const p = products.find((x) => x.id === v);
              if (p) setQuantity(p.minPurchase);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — ${p.retailPrice.toFixed(2)}/{unitNoun[p.billingUnit].replace(/s$/, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Quantity ({product ? unitNoun[product.billingUnit] : ""})</Label>
          <Input
            type="number"
            min={product?.minPurchase}
            max={product?.maxPurchase}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Total</Label>
          <div className="flex h-8 items-center text-lg font-semibold text-foreground">
            ${total.toFixed(2)}
          </div>
        </div>
        <Button onClick={handleBuy} disabled={submitting || !product}>
          <ShoppingCart className="h-4 w-4" />
          {submitting ? "Processing..." : "Buy now"}
        </Button>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Coupon code (optional)</Label>
        <Input
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="e.g. WELCOME10"
          className="uppercase"
        />
      </div>
    </div>
  );
}
