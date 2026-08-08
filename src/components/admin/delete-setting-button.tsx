"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteSettingButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/settings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete setting.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={busy} aria-label="Delete setting">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
