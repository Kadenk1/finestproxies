import { prisma } from "@/lib/db/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SystemSettingForm } from "@/components/admin/system-setting-form";
import { DeleteSettingButton } from "@/components/admin/delete-setting-button";
import { GatewayTuningForm } from "@/components/admin/gateway-tuning-form";
import { SiteRuleFormDialog } from "@/components/admin/site-rule-form-dialog";
import { SiteRuleRowActions } from "@/components/admin/site-rule-row-actions";
import { getGatewayTuning, GATEWAY_TUNING_SETTING_KEYS } from "@/lib/config/gateway-tuning";

export default async function AdminSystemSettingsPage() {
  const [settings, gatewayTuning, siteRules] = await Promise.all([
    prisma.systemSetting.findMany({
      where: { key: { notIn: GATEWAY_TUNING_SETTING_KEYS } },
      orderBy: { key: "asc" },
    }),
    getGatewayTuning(),
    prisma.siteRule.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <GatewayTuningForm initial={gatewayTuning} />

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Site rules</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-destination overrides of the gateway tuning above — e.g. more retry attempts for a
              reputation-sensitive target, or rotation checks off for a latency-sensitive one. Blank fields
              fall back to the global default.
            </p>
          </div>
          <SiteRuleFormDialog />
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Issuance attempts</TableHead>
                <TableHead>Rotation attempts</TableHead>
                <TableHead>Sticky window</TableHead>
                <TableHead className="text-right">Enabled / delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siteRules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No site rules yet — every destination uses the global gateway tuning above.
                  </TableCell>
                </TableRow>
              )}
              {siteRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-xs">{rule.pattern}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.label ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.issuanceQualityCheckMaxAttempts ?? "default"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.rotationQualityCheckMaxAttempts ?? "default"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.defaultStickyWindowMins ? `${rule.defaultStickyWindowMins}m` : "default"}
                  </TableCell>
                  <TableCell className="text-right">
                    <SiteRuleRowActions ruleId={rule.id} enabled={rule.enabled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generic key/value configuration, editable without a deploy.
          </p>
        </div>
        <SystemSettingForm />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No settings configured yet.
                </TableCell>
              </TableRow>
            )}
            {settings.map((setting) => (
              <TableRow key={setting.id}>
                <TableCell className="font-mono text-xs">{setting.key}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {JSON.stringify(setting.value)}
                </TableCell>
                <TableCell className="text-muted-foreground">{setting.description ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {setting.updatedAt.toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DeleteSettingButton id={setting.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
