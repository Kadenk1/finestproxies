"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function SiteRuleRowActions({ ruleId, enabled }: { ruleId: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleEnabled(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/site-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        toast.error("Failed to update rule.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/site-rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete rule.");
        return;
      }
      toast.success("Site rule deleted.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={busy} />
      <Button variant="ghost" size="icon-sm" onClick={remove} disabled={busy} aria-label="Delete site rule">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
