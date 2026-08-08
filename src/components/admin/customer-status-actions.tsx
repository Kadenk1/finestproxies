"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export function CustomerStatusActions({
  customerId,
  status,
}: {
  customerId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: "ACTIVE" | "SUSPENDED" | "BANNED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update status.");
        return;
      }
      toast.success(`Customer marked ${next.toLowerCase()}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy || status === "ACTIVE"}
        onClick={() => setStatus("ACTIVE")}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Activate
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || status === "SUSPENDED"}
        onClick={() => setStatus("SUSPENDED")}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        Suspend
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={busy || status === "BANNED"}
        onClick={() => setStatus("BANNED")}
      >
        <ShieldX className="h-3.5 w-3.5" />
        Ban
      </Button>
    </div>
  );
}
