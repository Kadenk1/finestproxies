"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { siteRuleSchema, type SiteRuleInput } from "@/lib/validation/site-rule";

/**
 * Creates a SiteRule. Every override field is optional (null = "use the
 * global default" from the Gateway tuning panel above) — left blank here,
 * so a rule only needs to set the specific knob(s) it actually wants to
 * change for that destination.
 */
export function SiteRuleFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof siteRuleSchema>, unknown, z.output<typeof siteRuleSchema>>({
    resolver: zodResolver(siteRuleSchema),
    defaultValues: { enabled: true },
  });

  async function onSubmit(values: SiteRuleInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/site-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save rule.");
        return;
      }
      toast.success("Site rule saved.");
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <Plus className="h-4 w-4" /> New site rule
      </Button>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New site rule</DialogTitle>
          <DialogDescription>
            Overrides the global gateway tuning for a specific destination. Leave a field blank to keep
            using the global default for it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Domain pattern</Label>
            <Input {...register("pattern")} placeholder="target.com or *.target.com" />
            {errors.pattern && <p className="text-xs text-destructive">{errors.pattern.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Label (optional)</Label>
            <Input {...register("label")} placeholder="Target — reputation sensitive" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issuance max attempts</Label>
              <Input
                type="number"
                min={1}
                max={10}
                {...register("issuanceQualityCheckMaxAttempts")}
                placeholder="default"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rotation max attempts</Label>
              <Input
                type="number"
                min={1}
                max={10}
                {...register("rotationQualityCheckMaxAttempts")}
                placeholder="default"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Default sticky window (mins)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              {...register("defaultStickyWindowMins")}
              placeholder="default"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Quality-check enabled/rotation toggles can be adjusted after creating the rule, from its row in
            the table below.
          </p>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
