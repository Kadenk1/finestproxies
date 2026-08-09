"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productSchema, type ProductInput } from "@/lib/validation/product";

interface ProductFormDialogProps {
  product?: {
    id: string;
    name: string;
    slug: string;
    type: "RESIDENTIAL" | "ISP" | "MOBILE";
    description: string | null;
    active: boolean;
    billingUnit: "GB" | "IP_MONTH" | "PORT_MONTH" | "FLAT";
    retailPrice: number;
    internalCostEstimate: number;
    minPurchase: number;
    maxPurchase: number;
    sortOrder: number;
    locations: string[];
  };
}

export function ProductFormDialog({ product }: ProductFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? { ...product, description: product.description ?? "", locations: product.locations.join(", ") }
      : {
          active: true,
          type: "RESIDENTIAL",
          billingUnit: "GB",
          sortOrder: 0,
        },
  });

  async function onSubmit(values: ProductInput) {
    setSubmitting(true);
    try {
      const res = await fetch(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save product.");
        return;
      }
      toast.success(product ? "Product updated." : "Product created.");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={product ? "ghost" : "default"}
        size={product ? "icon-sm" : "default"}
        onClick={() => setOpen(true)}
      >
        {product ? <Pencil className="h-3.5 w-3.5" /> : <><Plus className="h-4 w-4" /> New product</>}
      </Button>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Products are created without touching code — pricing, availability, and
            locations all live here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input {...register("slug")} />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          ({ RESIDENTIAL: "Residential", ISP: "ISP", MOBILE: "Mobile" })[v] ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                      <SelectItem value="ISP">ISP</SelectItem>
                      <SelectItem value="MOBILE">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Billing unit</Label>
              <Controller
                control={control}
                name="billingUnit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) =>
                          ({
                            GB: "GB",
                            IP_MONTH: "IP / month",
                            PORT_MONTH: "Port / month",
                            FLAT: "Flat",
                          })[v] ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GB">GB</SelectItem>
                      <SelectItem value="IP_MONTH">IP / month</SelectItem>
                      <SelectItem value="PORT_MONTH">Port / month</SelectItem>
                      <SelectItem value="FLAT">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Retail price ($)</Label>
              <Input type="number" step="0.0001" {...register("retailPrice")} />
              {errors.retailPrice && (
                <p className="text-xs text-destructive">{errors.retailPrice.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Internal cost ($)</Label>
              <Input type="number" step="0.0001" {...register("internalCostEstimate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min purchase</Label>
              <Input type="number" step="1" {...register("minPurchase")} />
            </div>
            <div className="space-y-1.5">
              <Label>Max purchase</Label>
              <Input type="number" step="1" {...register("maxPurchase")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Available locations (comma-separated country codes)</Label>
            <Input placeholder="US, GB, DE" {...register("locations")} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="active">Active</Label>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
