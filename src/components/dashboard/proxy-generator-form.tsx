"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Download, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  formatCredential,
  formatLabels,
  urlFormatLabel,
  type ProxyOutputFormat,
} from "@/lib/proxy-format";

interface ProductCatalogEntry {
  slug: string;
  name: string;
  hasBalance: boolean;
  locations: { country: string; region: string | null; city: string | null }[];
}

interface GeneratedCredential {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  sessionType: "ROTATING" | "STICKY";
  country: string | null;
}

// sessionType + duration collapsed into one control — "how often does the
// exit IP change" is one decision for the customer, even though it's two
// fields underneath.
const ipSwitchOptions = [
  { value: "rotating", label: "Rotating — new IP every request", sessionType: "ROTATING" as const, minutes: undefined },
  { value: "sticky-1", label: "Sticky — 1 minute", sessionType: "STICKY" as const, minutes: 1 },
  { value: "sticky-5", label: "Sticky — 5 minutes", sessionType: "STICKY" as const, minutes: 5 },
  { value: "sticky-10", label: "Sticky — 10 minutes", sessionType: "STICKY" as const, minutes: 10 },
  { value: "sticky-30", label: "Sticky — 30 minutes", sessionType: "STICKY" as const, minutes: 30 },
  { value: "sticky-60", label: "Sticky — 60 minutes", sessionType: "STICKY" as const, minutes: 60 },
];

export function ProxyGeneratorForm({ products }: { products: ProductCatalogEntry[] }) {
  const purchasable = products.filter((p) => p.hasBalance);
  const [productSlug, setProductSlug] = useState(purchasable[0]?.slug ?? "");
  const [country, setCountry] = useState<string>("any");
  const [region, setRegion] = useState<string>("any");
  const [city, setCity] = useState<string>("any");
  const [protocol, setProtocol] = useState<"HTTP" | "HTTPS">("HTTP");
  const [ipSwitch, setIpSwitch] = useState(ipSwitchOptions[0].value);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<GeneratedCredential[]>([]);
  const [format, setFormat] = useState<ProxyOutputFormat>("HOST_PORT_USER_PASS");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeProduct = products.find((p) => p.slug === productSlug);
  const countries = useMemo(
    () => Array.from(new Set(activeProduct?.locations.map((l) => l.country) ?? [])),
    [activeProduct],
  );
  const regions = useMemo(
    () =>
      Array.from(
        new Set(
          activeProduct?.locations
            .filter((l) => (country === "any" ? true : l.country === country) && l.region)
            .map((l) => l.region as string) ?? [],
        ),
      ),
    [activeProduct, country],
  );
  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          activeProduct?.locations
            .filter((l) => (country === "any" ? true : l.country === country) && l.city)
            .map((l) => l.city as string) ?? [],
        ),
      ),
    [activeProduct, country],
  );

  const formatOptions = useMemo(
    () => ["HOST_PORT_USER_PASS", "USER_PASS_HOST_PORT", "URL"] as ProxyOutputFormat[],
    [],
  );

  async function handleGenerate() {
    if (!productSlug) {
      toast.error("Purchase a product before generating credentials.");
      return;
    }
    const selectedSwitch = ipSwitchOptions.find((o) => o.value === ipSwitch)!;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          country: country === "any" ? undefined : country,
          region: region === "any" ? undefined : region,
          city: city === "any" ? undefined : city,
          protocol,
          sessionType: selectedSwitch.sessionType,
          sessionDurationMins: selectedSwitch.minutes,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate credentials.");
        return;
      }
      setResults(data.credentials);
      toast.success(`Generated ${data.credentials.length} credential(s).`);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerate(id: string) {
    try {
      const res = await fetch(`/api/dashboard/proxies/${id}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to regenerate credential.");
        return;
      }
      setResults((prev) => prev.map((c) => (c.id === id ? data.credential : c)));
      toast.success("Credential regenerated.");
    } catch {
      toast.error("Something went wrong. Try again.");
    }
  }

  function copyValue(cred: GeneratedCredential) {
    const value = formatCredential(cred, format);
    navigator.clipboard.writeText(value);
    setCopiedId(cred.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function downloadAll() {
    const lines = results.map((c) => formatCredential(c, format));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proxies.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyAll() {
    const lines = results.map((c) => formatCredential(c, format));
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`Copied ${results.length} credentials.`);
  }

  // Rendering thousands of individual rows (each with its own buttons) gets
  // sluggish and isn't useful anyway for a bulk list — past this size, show
  // a summary and point at copy/download instead of listing every row.
  const LIST_RENDER_LIMIT = 200;
  const isBulkResult = results.length > LIST_RENDER_LIMIT;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-4.5 w-4.5 text-primary" />
            Proxy Generator
          </CardTitle>
          <CardDescription>Configure and generate your proxy credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productSlug} onValueChange={(v) => v && setProductSlug(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.slug} value={p.slug} disabled={!p.hasBalance}>
                    {p.name} {!p.hasBalance && "(no balance)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {purchasable.length === 0 && (
              <p className="text-xs text-destructive">
                You don&apos;t have balance on any product yet — buy one from Orders first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select
              value={country}
              onValueChange={(v) => {
                if (!v) return;
                setCountry(v);
                setRegion("any");
                setCity("any");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any country</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={region} onValueChange={(v) => v && setRegion(v)} disabled={regions.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any state</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select value={city} onValueChange={(v) => v && setCity(v)} disabled={cities.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any city</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {regions.length === 0 && cities.length === 0 && (
            <p className="-mt-3 text-xs text-muted-foreground">
              State/city targeting isn&apos;t configured for this product yet.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Protocol</Label>
            <Select value={protocol} onValueChange={(v) => v && setProtocol(v as typeof protocol)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="HTTPS">HTTPS</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">SOCKS5 support is coming soon.</p>
          </div>

          <div className="space-y-1.5">
            <Label>IP Switch Time</Label>
            <Select value={ipSwitch} onValueChange={(v) => v && setIpSwitch(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ipSwitchOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Generate Type</Label>
            <Select value={format} onValueChange={(v) => v && setFormat(v as ProxyOutputFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f === "URL" ? urlFormatLabel(protocol) : formatLabels[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Quantity</Label>
              <span className="text-sm font-medium text-foreground">
                {quantity.toLocaleString()}
              </span>
            </div>
            <Slider
              min={1}
              max={5000}
              step={1}
              value={[quantity]}
              onValueChange={(v) => setQuantity(Array.isArray(v) ? v[0] : v)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={submitting || purchasable.length === 0}
            className="w-full"
          >
            <Wand2 className="h-4 w-4" />
            {submitting ? "Generating..." : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Generated credentials</CardTitle>
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="h-3.5 w-3.5" />
                Copy all
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Generated credentials will appear here. Passwords are shown once —
              copy or download them now.
            </p>
          ) : isBulkResult ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-lg font-semibold text-foreground">
                {results.length.toLocaleString()} credentials generated
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Passwords are shown once — a list this size isn&apos;t shown row by
                row. Use Copy all or Download .txt above to save them now.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3"
                >
                  <div className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">
                    {formatCredential(cred, format)}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy"
                      onClick={() => copyValue(cred)}
                    >
                      {copiedId === cred.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Generate new credentials"
                      onClick={() => handleRegenerate(cred.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
