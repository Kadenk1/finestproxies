import { request as httpRequest } from "http";

export interface ExitIpClassification {
  ip: string;
  /** True if the exit IP's ASN belongs to a mobile carrier (e.g. T-Mobile,
   * Verizon Wireless) — this catches carrier "Home Internet"/fixed-wireless
   * residential products too, since they register on the same ASN as
   * phones on that carrier's network. */
  mobile: boolean;
  /** True if ip-api's own threat data has this IP flagged as a known
   * VPN/public-proxy/Tor exit. This is exactly the kind of signal
   * reputation-sensitive challenge systems (hCaptcha, Cloudflare, etc.)
   * screen for — an IP already flagged here is disproportionately likely
   * to get a "rate limited or blocked" response before a challenge even
   * renders, independent of request behavior. */
  knownProxy: boolean;
  /** True if the IP is registered to a hosting/datacenter ASN rather than
   * a residential ISP. A "residential" product handing out a datacenter
   * IP is both a trust-signal problem for the customer and a mislabeled
   * product — same reputation risk as knownProxy. */
  hosting: boolean;
  isp: string;
}

/** True if this classification carries any signal that would make a
 * reputation-sensitive challenge system more likely to flag the IP. Kept
 * as one predicate so callers (and future signals added here) don't need
 * to know the individual field names. */
export function isLowReputation(c: ExitIpClassification): boolean {
  return c.knownProxy || c.hosting;
}

/**
 * Classifies the exit IP behind a freshly-created upstream session by
 * making one request *through* it to ip-api.com's free geolocation API —
 * its `mobile` field is exactly the residential-vs-carrier-ASN signal
 * customers see in third-party proxy checkers, and `proxy`/`hosting` are
 * its known-VPN/proxy and datacenter-ASN flags respectively. Uses plain
 * HTTP (ip-api's free tier doesn't support HTTPS), proxied as an ordinary
 * absolute-URI request, the same shape gateway-agent/index.js uses for its
 * own upstream requests.
 *
 * This is a free, best-effort signal, not a dedicated fraud-scoring
 * service — it catches IPs already on ip-api's own known-proxy/hosting
 * lists, not every IP a given target's risk engine might flag. Fails open
 * (resolves null) on any error, bad response, or timeout — an unreachable
 * classifier should never block issuing a credential outright, it should
 * just skip the filter for that attempt.
 */
export function classifyExitIp(
  upstreamHost: string,
  upstreamPort: number,
  upstreamUsername: string,
  upstreamPassword: string,
): Promise<ExitIpClassification | null> {
  return new Promise((resolve) => {
    const auth = Buffer.from(`${upstreamUsername}:${upstreamPassword}`).toString("base64");
    const req = httpRequest(
      {
        host: upstreamHost,
        port: upstreamPort,
        method: "GET",
        path: "http://ip-api.com/json/?fields=status,query,mobile,proxy,hosting,isp",
        headers: { "Proxy-Authorization": `Basic ${auth}`, Host: "ip-api.com" },
        timeout: 8_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (json.status !== "success" || typeof json.query !== "string") {
              return resolve(null);
            }
            resolve({
              ip: json.query,
              mobile: Boolean(json.mobile),
              knownProxy: Boolean(json.proxy),
              hosting: Boolean(json.hosting),
              isp: json.isp ?? "unknown",
            });
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}
