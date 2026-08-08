"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { gatewaySchema, type GatewayInput } from "@/lib/validation/gateway";

interface GatewayFormDialogProps {
  gateway?: GatewayInput & { id: string };
}

export function GatewayFormDialog({ gateway }: GatewayFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GatewayInput>({
    resolver: zodResolver(gatewaySchema),
    defaultValues: gateway ?? { status: "HEALTHY" },
  });

  async function onSubmit(values: GatewayInput) {
    setSubmitting(true);
    try {
      const res = await fetch(
        gateway ? `/api/admin/gateways/${gateway.id}` : "/api/admin/gateways",
        {
          method: gateway ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save gateway.");
        return;
      }
      toast.success(gateway ? "Gateway updated." : "Gateway created.");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={gateway ? "ghost" : "default"}
        size={gateway ? "icon-sm" : "default"}
        onClick={() => setOpen(true)}
      >
        {gateway ? <Pencil className="h-3.5 w-3.5" /> : <><Plus className="h-4 w-4" /> New gateway</>}
      </Button>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{gateway ? "Edit gateway" : "New gateway"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Hostname</Label>
            <Input {...register("hostname")} placeholder="resi.finestproxies.com" />
            {errors.hostname && (
              <p className="text-xs text-destructive">{errors.hostname.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>IP address</Label>
              <Input {...register("ipAddress")} placeholder="203.0.113.10" />
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input {...register("region")} placeholder="us-east" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEALTHY">Healthy</SelectItem>
                    <SelectItem value="DEGRADED">Degraded</SelectItem>
                    <SelectItem value="OFFLINE">Offline</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : gateway ? "Save changes" : "Create gateway"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
