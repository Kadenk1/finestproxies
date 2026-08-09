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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { couponSchema, type CouponInput } from "@/lib/validation/coupon";

interface CouponFormDialogProps {
  coupon?: CouponInput & { id: string };
}

export function CouponFormDialog({ coupon }: CouponFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.input<typeof couponSchema>, unknown, z.output<typeof couponSchema>>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon ?? { type: "PERCENT", active: true },
  });

  async function onSubmit(values: CouponInput) {
    setSubmitting(true);
    try {
      const res = await fetch(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", {
        method: coupon ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save coupon.");
        return;
      }
      toast.success(coupon ? "Coupon updated." : "Coupon created.");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={coupon ? "ghost" : "default"}
        size={coupon ? "icon-sm" : "default"}
        onClick={() => setOpen(true)}
      >
        {coupon ? <Pencil className="h-3.5 w-3.5" /> : <><Plus className="h-4 w-4" /> New coupon</>}
      </Button>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{coupon ? "Edit coupon" : "New coupon"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input {...register("code")} placeholder="WELCOME10" className="uppercase" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
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
                          ({ PERCENT: "Percent off", FIXED_AMOUNT: "Fixed amount off", FREE_GB: "Free GB" })[
                            v
                          ] ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percent off</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">Fixed amount off</SelectItem>
                      <SelectItem value="FREE_GB">Free GB</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input type="number" step="0.01" {...register("value")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max redemptions</Label>
              <Input type="number" {...register("maxRedemptions")} placeholder="Unlimited" />
            </div>
            <div className="space-y-1.5">
              <Label>Expires</Label>
              <Input type="date" {...register("expiresAt")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="coupon-active">Active</Label>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="coupon-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : coupon ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
