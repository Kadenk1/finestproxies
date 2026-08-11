"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hard-deletes a Provider. A provider with real session/usage history
 * can't be deleted by default (see the DELETE route's 409, hasHistory:
 * true) — on that response, this offers a SECOND, more explicit
 * confirmation to force-delete (?force=true), which also permanently
 * destroys that history. Two separate confirm() prompts, not one, so
 * discarding real historical data is never one accidental click away from
 * a normal delete.
 */
export function DeleteProviderButton({ providerId, providerName }: { providerId: string; providerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(force = false) {
    const confirmMessage = force
      ? `This will PERMANENTLY delete "${providerName}" AND its session/usage history. This cannot be undone. Continue?`
      : `Delete provider "${providerName}"? This cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setBusy(true);
    try {
      const url = `/api/admin/providers/${providerId}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.hasHistory && !force) {
          toast.error(data.error, {
            action: { label: "Force delete", onClick: () => remove(true) },
          });
          return;
        }
        toast.error(data?.error ?? "Failed to delete provider.");
        return;
      }
      toast.success(data?.message ?? `Provider "${providerName}" deleted.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => remove(false)}
      disabled={busy}
      aria-label={`Delete provider ${providerName}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
