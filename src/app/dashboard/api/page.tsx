import { Code2 } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

export default function ApiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Programmatic access to your account.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Code2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          API key management is coming soon
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Programmatic credential provisioning and usage endpoints (create,
          disable, and monitor proxy credentials from your own systems) are
          planned for a later phase. In the meantime, you can generate and
          manage credentials from the dashboard, and use them directly with
          any HTTP/HTTPS or SOCKS5-compatible client.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <LinkButton href="/docs" variant="outline">
            View documentation
          </LinkButton>
          <LinkButton href="/dashboard/proxy-generator">Proxy Generator</LinkButton>
        </div>
      </div>
    </div>
  );
}
