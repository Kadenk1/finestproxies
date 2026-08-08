"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProviderLocationsForm({
  providerId,
  defaultValue,
}: {
  providerId: string;
  defaultValue: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save locations.");
        return;
      }
      toast.success("Locations updated.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label>Available locations (comma-separated country codes)</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="US, GB, DE" />
        <Button type="submit" disabled={submitting} variant="outline">
          Save
        </Button>
      </div>
    </form>
  );
}
