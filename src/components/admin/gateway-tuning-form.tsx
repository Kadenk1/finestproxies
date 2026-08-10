"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { GatewayTuning } from "@/lib/config/gateway-tuning";
import { gatewayTuningSchema } from "@/lib/validation/gateway-tuning";

/**
 * Live-editable gateway/routing knobs — see gateway-tuning.ts for what each
 * field controls and why it exists. Saves apply within ~30s (the read-side
 * cache TTL), not instantly — this is a tuning panel, not a kill switch.
 */
export function GatewayTuningForm({ initial }: { initial: GatewayTuning }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = gatewayTuningSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Check the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gateway-tuning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      toast.success("Gateway tuning saved — takes effect within ~30s.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border/70 bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Gateway tuning</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Exit-IP quality screening and sticky session defaults — editable without a deploy.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Exit-IP quality check</p>
          <p className="text-xs text-muted-foreground">
            Screen new RESIDENTIAL exit IPs for mobile-carrier ASN and known-proxy/hosting reputation flags.
            Off = every check below is skipped everywhere.
          </p>
        </div>
        <Switch
          checked={values.qualityCheckEnabled}
          onCheckedChange={(checked) => setValues((v) => ({ ...v, qualityCheckEnabled: checked }))}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Check on rotation</p>
          <p className="text-xs text-muted-foreground">
            Runs inline on a customer&apos;s live request when their sticky session rotates — adds real
            latency (a network round-trip per attempt) before their page loads. Turn off to keep issuance-time
            screening but cut this cost.
          </p>
        </div>
        <Switch
          checked={values.qualityCheckOnRotation}
          disabled={!values.qualityCheckEnabled}
          onCheckedChange={(checked) => setValues((v) => ({ ...v, qualityCheckOnRotation: checked }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Issuance max attempts</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={values.issuanceQualityCheckMaxAttempts}
            onChange={(e) =>
              setValues((v) => ({ ...v, issuanceQualityCheckMaxAttempts: Number(e.target.value) }))
            }
          />
          <p className="text-xs text-muted-foreground">Batches of up to 25 credentials only.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Rotation max attempts</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={values.rotationQualityCheckMaxAttempts}
            onChange={(e) =>
              setValues((v) => ({ ...v, rotationQualityCheckMaxAttempts: Number(e.target.value) }))
            }
          />
          <p className="text-xs text-muted-foreground">Runs on every customer&apos;s live request.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Default sticky window (mins)</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={values.defaultStickyWindowMins}
            onChange={(e) => setValues((v) => ({ ...v, defaultStickyWindowMins: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">Applies to newly issued credentials only.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save gateway tuning"}
        </Button>
      </div>
    </div>
  );
}
