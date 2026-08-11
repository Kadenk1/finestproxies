"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hard-deletes a Provider. A provider with real session/usage history
 * can't be deleted (see the DELETE route's 409) — that response's error
 * text explains why and points at disabling instead, so it's surfaced
 * directly rather than replaced with a generic failure toast.
 */
export function DeleteProviderButton({ providerId, providerName }: { providerId: string; providerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete provider "${providerName}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to delete provider.");
        return;
      }
      toast.success(`Provider "${providerName}" deleted.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={remove}
      disabled={busy}
      aria-label={`Delete provider ${providerName}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
