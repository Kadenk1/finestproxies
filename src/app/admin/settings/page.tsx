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

export default async function AdminSystemSettingsPage() {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="space-y-6">
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
