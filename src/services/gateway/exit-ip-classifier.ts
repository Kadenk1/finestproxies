import { request as httpRequest } from "http";

export interface ExitIpClassification {
  ip: string;
  /** True if the exit IP's ASN belongs to a mobile carrier (e.g. T-Mobile,
   * Verizon Wireless) — this catches carrier "Home Internet"/fixed-wireless
   * residential products too, since they register on the same ASN as
   * phones on that carrier's network. */
  mobile: boolean;
  isp: string;
}

/**
 * Classifies the exit IP behind a freshly-created upstream session by
 * making one request *through* it to ip-api.com's free geolocation API —
 * its `mobile` field is exactly the residential-vs-carrier-ASN signal
 * customers see in third-party proxy checkers. Uses plain HTTP (ip-api's
 * free tier doesn't support HTTPS), proxied as an ordinary absolute-URI
 * request, the same shape gateway-agent/index.js uses for its own
 * upstream requests.
 *
 * Fails open (resolves null) on any error, bad response, or timeout — an
 * unreachable classifier should never block issuing a credential outright,
 * it should just skip the filter for that attempt.
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
        path: "http://ip-api.com/json/?fields=status,query,mobile,isp",
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
            resolve({ ip: json.query, mobile: Boolean(json.mobile), isp: json.isp ?? "unknown" });
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
