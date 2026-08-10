import { z } from "zod";

export const heartbeatSchema = z.object({
  hostname: z.string().trim().min(1),
  status: z.enum(["HEALTHY", "DEGRADED", "OFFLINE", "MAINTENANCE"]),
  cpuPercent: z.number().min(0).max(100).optional(),
  memoryPercent: z.number().min(0).max(100).optional(),
  activeConnections: z.number().int().min(0).optional(),
  bandwidthBps: z.number().min(0).optional(),
  latencyMs: z.number().min(0).optional(),
  uptimeSeconds: z.number().min(0).optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const usageIngestSchema = z.object({
  gatewayHostname: z.string().trim().min(1),
  credentialUsername: z.string().trim().min(1),
  bytesUploaded: z.number().min(0),
  bytesDownloaded: z.number().min(0),
  requestCount: z.number().int().min(0).default(0),
  occurredAt: z.string().datetime().optional(),
  /** Caller-supplied idempotency key — required so retried deliveries never double-charge. */
  dedupeKey: z.string().trim().min(1),
});

export type UsageIngestInput = z.infer<typeof usageIngestSchema>;

export const resolveCredentialSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  /** Set by the gateway agent retrying after the current exit IP failed. */
  forceRotate: z.boolean().optional(),
  /** The destination host of the client's CONNECT/request, e.g.
   * "checkout.target.com". Optional and best-effort — used only to look up
   * a per-site SiteRule override (see gateway-tuning.ts); omitting it just
   * means the global tuning default applies, same as before this existed. */
  targetHost: z.string().trim().min(1).max(255).optional(),
});

export type ResolveCredentialInput = z.infer<typeof resolveCredentialSchema>;

// gateway-agent's own classifyError() classes, plus TLS — see
// connection-health.ts's ConnectionEvent doc comment for how these feed
// per-destination-per-pool scoring.
const errorClassEnum = z.enum(["TIMEOUT", "DNS", "TCP", "TLS", "UPSTREAM_REJECTED", "OTHER"]);

const connectionStatEventSchema = z.object({
  targetHost: z.string().trim().min(1).max(255),
  providerSlug: z.string().trim().min(1).max(120),
  success: z.boolean(),
  errorClass: errorClassEnum.optional(),
  connectLatencyMs: z.number().min(0),
  bytesUploaded: z.number().min(0).default(0),
  bytesDownloaded: z.number().min(0).default(0),
  sessionId: z.string().trim().min(1).max(255).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const connectionStatsIngestSchema = z.object({
  events: z.array(connectionStatEventSchema).min(1).max(500),
});

export type ConnectionStatsIngestInput = z.infer<typeof connectionStatsIngestSchema>;
