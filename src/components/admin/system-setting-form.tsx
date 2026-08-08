"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { systemSettingSchema, type SystemSettingInput } from "@/lib/validation/system-setting";

export function SystemSettingForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SystemSettingInput>({ resolver: zodResolver(systemSettingSchema) });

  async function onSubmit(values: SystemSettingInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save setting.");
        return;
      }
      toast.success("Setting saved.");
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New setting
      </Button>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New system setting</DialogTitle>
          <DialogDescription>
            Value is stored as JSON — plain text and numbers are stored as-is.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input {...register("key")} placeholder="support.default_priority" />
            {errors.key && <p className="text-xs text-destructive">{errors.key.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input {...register("value")} placeholder='"MEDIUM" or 42 or {"a":1}' />
            {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save setting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
