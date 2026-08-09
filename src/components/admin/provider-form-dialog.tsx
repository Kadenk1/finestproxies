"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
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
import { providerSchema, type ProviderInput } from "@/lib/validation/provider";

interface ProviderFormDialogProps {
  provider?: Omit<ProviderInput, "apiKey"> & { id: string; hasCredential: boolean };
}

export function ProviderFormDialog({ provider }: ProviderFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.input<typeof providerSchema>, unknown, z.output<typeof providerSchema>>({
    resolver: zodResolver(providerSchema),
    defaultValues: provider ?? {
      enabled: true,
      priority: 100,
      weight: 100,
      extraCredentials: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "extraCredentials" });

  async function onSubmit(values: ProviderInput) {
    setSubmitting(true);
    try {
      const res = await fetch(
        provider ? `/api/admin/providers/${provider.id}` : "/api/admin/providers",
        {
          method: provider ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save provider.");
        return;
      }
      toast.success(provider ? "Provider updated." : "Provider created.");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={provider ? "ghost" : "default"}
        size={provider ? "icon-sm" : "default"}
        onClick={() => setOpen(true)}
      >
        {provider ? <Pencil className="h-3.5 w-3.5" /> : <><Plus className="h-4 w-4" /> New provider</>}
      </Button>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{provider ? "Edit provider" : "New upstream provider"}</DialogTitle>
          <DialogDescription>
            Secrets are encrypted at rest and never shown again after saving.
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
              <Input {...register("slug")} disabled={Boolean(provider)} />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>API base URL</Label>
            <Input {...register("apiBaseUrl")} placeholder="https://api.example.com" />
          </div>

          <div className="space-y-1.5">
            <Label>
              API key {provider?.hasCredential && "(leave blank to keep current secret)"}
            </Label>
            <Input type="password" {...register("apiKey")} placeholder="••••••••••••" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Additional credentials</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ label: "", value: "" })}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              For providers that need more than one secret — e.g. an account ID, a zone name,
              and a separate proxy password. Each is stored under the label you give it, encrypted at rest.
            </p>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <Input
                  {...register(`extraCredentials.${index}.label` as const)}
                  placeholder="Label, e.g. zone_password"
                  className="flex-1"
                />
                <Input
                  type="password"
                  {...register(`extraCredentials.${index}.value` as const)}
                  placeholder="Value"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                  aria-label="Remove credential"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority (lower = preferred)</Label>
              <Input type="number" {...register("priority")} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" {...register("weight")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="provider-enabled">Enabled</Label>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch id="provider-enabled" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : provider ? "Save changes" : "Create provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
