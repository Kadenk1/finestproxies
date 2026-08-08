"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();

  async function handleChange(value: string | null) {
    if (!value) return;
    const res = await fetch(`/api/admin/support/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: value }),
    });
    if (!res.ok) {
      toast.error("Failed to update status.");
      return;
    }
    router.refresh();
  }

  return (
    <Select value={status} onValueChange={handleChange}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="OPEN">Open</SelectItem>
        <SelectItem value="PENDING">Pending</SelectItem>
        <SelectItem value="RESOLVED">Resolved</SelectItem>
        <SelectItem value="CLOSED">Closed</SelectItem>
      </SelectContent>
    </Select>
  );
}
