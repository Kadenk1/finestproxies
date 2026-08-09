"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Zap, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface CredentialRow {
  id: string;
  username: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  sessionType: "ROTATING" | "STICKY";
  country: string | null;
  status: "ACTIVE" | "DISABLED" | "EXPIRED";
  gatewayName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const statusVariant: Record<CredentialRow["status"], "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  DISABLED: "secondary",
  EXPIRED: "destructive",
};

export function CredentialList({ initialRows }: { initialRows: CredentialRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/dashboard/proxies/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to revoke credential.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "DISABLED" } : r)));
      toast.success("Credential revoked.");
    } finally {
      setBusyId(null);
    }
  }

  async function simulateUsage(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/dashboard/usage/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to simulate usage.");
        return;
      }
      toast.success("Simulated traffic recorded — see Usage for details.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center text-sm text-muted-foreground">
        No credentials generated yet for this product. Use the Proxy Generator to create one.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Gateway</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.username}</TableCell>
              <TableCell>{row.protocol}</TableCell>
              <TableCell>{row.sessionType === "ROTATING" ? "Rotating" : "Sticky"}</TableCell>
              <TableCell>{row.country ?? "Any"}</TableCell>
              <TableCell className="text-muted-foreground">{row.gatewayName}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(row.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Simulate usage"
                    disabled={busyId === row.id || row.status !== "ACTIVE"}
                    onClick={() => simulateUsage(row.id)}
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Revoke"
                    disabled={busyId === row.id || row.status !== "ACTIVE"}
                    onClick={() => revoke(row.id)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
