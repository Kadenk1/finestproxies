import { prisma } from "@/lib/db/prisma";

/**
 * Tunable gateway/routing knobs, editable live from /admin/settings (stored
 * as SystemSetting rows) instead of requiring a code change + redeploy for
 * every adjustment. Every field has a default matching what was previously
 * hardcoded in gateway-service.ts — an admin who never touches these gets
 * identical behavior to before this existed.
 *
 * Read on a short cache (see CACHE_TTL_MS) since getGatewayTuning() is
 * called from the live credential-resolve path — every proxy CONNECT a
 * customer makes eventually goes through this on a cache miss, so it must
 * stay cheap and must never let a slow/unreachable DB block a resolve.
 * Fails open to defaults on any read error, same philosophy as
 * classifyExitIp and checkRateLimit elsewhere in this codebase.
 */
export interface GatewayTuning {
  /** Master switch for the exit-IP quality screen (mobile-ASN + reputation
   * checks in exit-ip-classifier.ts). Off skips it entirely everywhere —
   * issuance and rotation both mint whatever the pool hands back, same as
   * before that feature existed. */
  qualityCheckEnabled: boolean;
  /** Whether the quality check runs during session ROTATION specifically
   * (resolveActiveUpstreamSession) — this is the one that runs inline on a
   * customer's live request and adds real latency (a synchronous call to
   * ip-api.com, up to its own timeout) before their page starts loading.
   * Independent from qualityCheckEnabled so issuance-time screening can
   * stay on while rotation-time screening is turned off to cut latency,
   * without losing the check entirely. */
  qualityCheckOnRotation: boolean;
  /** Max mint attempts when issuing new credentials (generateProxyCredentials).
   * 1 = mint once, never retry even if flagged. */
  issuanceQualityCheckMaxAttempts: number;
  /** Max mint attempts on rotation (resolveActiveUpstreamSession). Kept
   * separate from the issuance limit since this one is latency-sensitive —
   * an admin may want this lower than the issuance limit even with
   * qualityCheckOnRotation enabled. */
  rotationQualityCheckMaxAttempts: number;
  /** Default STICKY session window in minutes, used when a credential was
   * generated without an explicit sessionDurationMins. Does not affect
   * already-issued credentials — only the default for new ones. */
  defaultStickyWindowMins: number;
}

const DEFAULTS: GatewayTuning = {
  qualityCheckEnabled: true,
  qualityCheckOnRotation: true,
  issuanceQualityCheckMaxAttempts: 4,
  rotationQualityCheckMaxAttempts: 2,
  defaultStickyWindowMins: 30,
};

const SETTING_KEYS: Record<keyof GatewayTuning, string> = {
  qualityCheckEnabled: "gateway.quality_check_enabled",
  qualityCheckOnRotation: "gateway.quality_check_on_rotation",
  issuanceQualityCheckMaxAttempts: "gateway.issuance_quality_check_max_attempts",
  rotationQualityCheckMaxAttempts: "gateway.rotation_quality_check_max_attempts",
  defaultStickyWindowMins: "gateway.default_sticky_window_mins",
};

// Reverse lookup, built once — lets the admin UI show/group these under one
// "Gateway tuning" section instead of the generic settings table treating
// them as unrelated arbitrary keys.
export const GATEWAY_TUNING_SETTING_KEYS: string[] = Object.values(SETTING_KEYS);

const CACHE_TTL_MS = 30_000;
let cache: { value: GatewayTuning; expiresAt: number } | null = null;

function boolSetting(byKey: Map<string, unknown>, settingKey: string, fallback: boolean): boolean {
  const raw = byKey.get(settingKey);
  return typeof raw === "boolean" ? raw : fallback;
}

function numberSetting(byKey: Map<string, unknown>, settingKey: string, fallback: number): number {
  const raw = byKey.get(settingKey);
  const num = typeof raw === "number" ? raw : Number(raw);
  return raw !== undefined && Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Returns the current gateway tuning config, merging any SystemSetting
 * overrides on top of DEFAULTS. Safe to call on every request — cached for
 * CACHE_TTL_MS and falls back to DEFAULTS (not an error) if the DB read
 * fails, so an outage never blocks a proxy resolve.
 */
export async function getGatewayTuning(): Promise<GatewayTuning> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: GATEWAY_TUNING_SETTING_KEYS } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const value: GatewayTuning = {
      qualityCheckEnabled: boolSetting(byKey, SETTING_KEYS.qualityCheckEnabled, DEFAULTS.qualityCheckEnabled),
      qualityCheckOnRotation: boolSetting(
        byKey,
        SETTING_KEYS.qualityCheckOnRotation,
        DEFAULTS.qualityCheckOnRotation,
      ),
      issuanceQualityCheckMaxAttempts: numberSetting(
        byKey,
        SETTING_KEYS.issuanceQualityCheckMaxAttempts,
        DEFAULTS.issuanceQualityCheckMaxAttempts,
      ),
      rotationQualityCheckMaxAttempts: numberSetting(
        byKey,
        SETTING_KEYS.rotationQualityCheckMaxAttempts,
        DEFAULTS.rotationQualityCheckMaxAttempts,
      ),
      defaultStickyWindowMins: numberSetting(
        byKey,
        SETTING_KEYS.defaultStickyWindowMins,
        DEFAULTS.defaultStickyWindowMins,
      ),
    };

    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return DEFAULTS;
  }
}

// ---- Per-site overrides --------------------------------------------------

/** Matches a request's destination hostname against a SiteRule.pattern.
 * Exact match ("target.com" against "target.com") or a "*.<domain>" prefix
 * matching that domain and any subdomain — "*.target.com" matches
 * "www.target.com", "checkout.target.com", and "target.com" itself. Not a
 * general glob/regex — deliberately narrow so a typo'd pattern fails to
 * match (falls back to the global default) rather than silently matching
 * something unintended. */
export function siteRuleMatches(pattern: string, hostname: string): boolean {
  const host = hostname.toLowerCase();
  const pat = pattern.toLowerCase();
  if (pat.startsWith("*.")) {
    const base = pat.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === pat;
}

const SITE_RULES_CACHE_TTL_MS = 30_000;
let siteRulesCache: { rows: SiteRuleRow[]; expiresAt: number } | null = null;

interface SiteRuleRow {
  pattern: string;
  qualityCheckEnabled: boolean | null;
  qualityCheckOnRotation: boolean | null;
  issuanceQualityCheckMaxAttempts: number | null;
  rotationQualityCheckMaxAttempts: number | null;
  defaultStickyWindowMins: number | null;
}

async function loadEnabledSiteRules(): Promise<SiteRuleRow[]> {
  if (siteRulesCache && siteRulesCache.expiresAt > Date.now()) return siteRulesCache.rows;
  try {
    const rows = await prisma.siteRule.findMany({
      where: { enabled: true },
      select: {
        pattern: true,
        qualityCheckEnabled: true,
        qualityCheckOnRotation: true,
        issuanceQualityCheckMaxAttempts: true,
        rotationQualityCheckMaxAttempts: true,
        defaultStickyWindowMins: true,
      },
    });
    siteRulesCache = { rows, expiresAt: Date.now() + SITE_RULES_CACHE_TTL_MS };
    return rows;
  } catch {
    // Fail open: no rule applies, callers fall back to the global default.
    return [];
  }
}

/**
 * Resolves the effective tuning for a specific destination hostname:
 * global defaults (getGatewayTuning) with any matching, enabled SiteRule's
 * non-null fields overlaid on top. `hostname` is optional — omit it (e.g.
 * for a call site with no destination context, like batch issuance) to get
 * the global tuning unchanged.
 *
 * When more than one enabled rule matches the same hostname (e.g. both
 * "target.com" and "*.target.com" exist), the more specific — non-wildcard
 * — pattern wins; among equally-specific matches, the most recently
 * updated rule wins. This mirrors how most rule-based systems (firewall
 * rules, CDN path rules) resolve overlapping matches, so it stays
 * predictable as more rules get added.
 */
/** Exact match beats wildcard; among equally-specific matches, the longer
 * (more specific) pattern wins. Shared by every "which rule applies to this
 * hostname" call site so they all resolve overlapping rules identically. */
function pickBestMatchingRule<T extends { pattern: string }>(rules: T[], hostname: string): T | null {
  const matches = rules.filter((r) => siteRuleMatches(r.pattern, hostname));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const aWildcard = a.pattern.startsWith("*.") ? 1 : 0;
    const bWildcard = b.pattern.startsWith("*.") ? 1 : 0;
    if (aWildcard !== bWildcard) return aWildcard - bWildcard; // exact (0) before wildcard (1)
    return b.pattern.length - a.pattern.length; // longer/more specific pattern first as a tiebreak
  });
  return matches[0];
}

export async function getEffectiveGatewayTuning(hostname?: string): Promise<GatewayTuning> {
  const base = await getGatewayTuning();
  if (!hostname) return base;

  const rules = await loadEnabledSiteRules();
  const rule = pickBestMatchingRule(rules, hostname);
  if (!rule) return base;

  return {
    qualityCheckEnabled: rule.qualityCheckEnabled ?? base.qualityCheckEnabled,
    qualityCheckOnRotation: rule.qualityCheckOnRotation ?? base.qualityCheckOnRotation,
    issuanceQualityCheckMaxAttempts: rule.issuanceQualityCheckMaxAttempts ?? base.issuanceQualityCheckMaxAttempts,
    rotationQualityCheckMaxAttempts: rule.rotationQualityCheckMaxAttempts ?? base.rotationQualityCheckMaxAttempts,
    defaultStickyWindowMins: rule.defaultStickyWindowMins ?? base.defaultStickyWindowMins,
  };
}

/** The bucket every destination-aware stat/health/routing lookup groups by
 * — the matched SiteRule's pattern, or the literal "default" if no enabled
 * rule matches. Using this (not the raw hostname) is what keeps
 * "target.com" and "checkout.target.com" and "api.target.com" from
 * fragmenting into separate stats/health buckets when a "*.target.com"
 * rule covers all of them. */
export const DEFAULT_DESTINATION_PATTERN = "default";

export async function resolveDestinationPattern(hostname: string): Promise<string> {
  const rules = await loadEnabledSiteRules();
  const rule = pickBestMatchingRule(rules, hostname);
  return rule?.pattern ?? DEFAULT_DESTINATION_PATTERN;
}

// ---- Routing profile (preferred/fallback pools, region, limits) ----------

export interface SiteRoutingProfile {
  pattern: string;
  preferredProviderSlug: string | null;
  fallbackProviderSlugs: string[];
  region: string | null;
  connectionTimeoutMs: number | null;
  maxConnectionAttempts: number | null;
  concurrencyLimit: number | null;
  routingWeight: number | null;
}

const ROUTING_PROFILE_CACHE_TTL_MS = 30_000;
let routingProfileCache: { rows: SiteRoutingProfile[]; expiresAt: number } | null = null;

async function loadEnabledRoutingProfiles(): Promise<SiteRoutingProfile[]> {
  if (routingProfileCache && routingProfileCache.expiresAt > Date.now()) return routingProfileCache.rows;
  try {
    const rows = await prisma.siteRule.findMany({
      where: { enabled: true },
      select: {
        pattern: true,
        preferredProviderSlug: true,
        fallbackProviderSlugs: true,
        region: true,
        connectionTimeoutMs: true,
        maxConnectionAttempts: true,
        concurrencyLimit: true,
        routingWeight: true,
      },
    });
    routingProfileCache = { rows, expiresAt: Date.now() + ROUTING_PROFILE_CACHE_TTL_MS };
    return rows;
  } catch {
    return [];
  }
}

/** Resolves the routing profile for a destination hostname — null when no
 * enabled SiteRule matches, meaning "use the global/default routing
 * behavior with no per-site preferences." Every field on a matched profile
 * can still independently be null (no override for that one knob). */
export async function getSiteRoutingProfile(hostname: string): Promise<SiteRoutingProfile | null> {
  const rows = await loadEnabledRoutingProfiles();
  return pickBestMatchingRule(rows, hostname);
}
