import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";

export default async function SettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session!.user.id } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account profile and security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultName={user.name ?? ""} defaultCompany={user.companyName ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password signs out all other sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border/70 p-4">
            <div className="flex items-center gap-3">
              <Switch disabled checked={false} id="2fa" />
              <Label htmlFor="2fa" className="text-muted-foreground">
                Two-factor authentication (coming soon)
              </Label>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The account schema already supports TOTP-based 2FA; the setup
            flow (QR enrollment, recovery codes) is planned for a later
            phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
