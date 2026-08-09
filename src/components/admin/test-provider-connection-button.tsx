"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TestProviderConnectionButton({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Connection test failed.");
        return;
      }
      if (data.result.status === "HEALTHY") {
        toast.success(`Connected — ${data.result.latencyMs}ms`);
      } else {
        toast.error("Provider reported unhealthy — check credentials.");
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
      {testing ? "Testing..." : "Test connection"}
    </Button>
  );
}
