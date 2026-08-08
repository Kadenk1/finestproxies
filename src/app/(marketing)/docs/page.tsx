import type { Metadata } from "next";
import { CodeTabs } from "@/components/marketing/code-tabs";
import { gatewayHosts, gatewayPorts } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Documentation" };

const exampleHost = gatewayHosts.residential;
const exampleUser = "cg_example_user";
const examplePass = "example_password";

const httpExamples = [
  {
    value: "curl",
    label: "cURL",
    code: `curl -x http://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http} https://ip.example.com`,
  },
  {
    value: "python",
    label: "Python",
    code: `import requests

proxies = {
    "http": "http://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http}",
    "https": "http://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http}",
}

response = requests.get("https://ip.example.com", proxies=proxies)
print(response.text)`,
  },
  {
    value: "node",
    label: "Node.js",
    code: `import { HttpsProxyAgent } from "https-proxy-agent";

const agent = new HttpsProxyAgent(
  "http://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http}"
);

const response = await fetch("https://ip.example.com", { agent });
console.log(await response.text());`,
  },
];

const socks5Examples = [
  {
    value: "curl",
    label: "cURL",
    code: `curl --socks5-hostname ${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.socks5} https://ip.example.com`,
  },
  {
    value: "python",
    label: "Python",
    code: `import requests

proxies = {
    "http": "socks5h://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.socks5}",
    "https": "socks5h://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.socks5}",
}

response = requests.get("https://ip.example.com", proxies=proxies)
print(response.text)`,
  },
  {
    value: "node",
    label: "Node.js",
    code: `import { SocksProxyAgent } from "socks-proxy-agent";

const agent = new SocksProxyAgent(
  "socks5://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.socks5}"
);

const response = await fetch("https://ip.example.com", { agent });
console.log(await response.text());`,
  },
];

const sections = [
  { id: "getting-started", label: "Getting started" },
  { id: "http-https", label: "HTTP/HTTPS usage" },
  { id: "socks5", label: "SOCKS5 usage" },
  { id: "formats", label: "Credential formats" },
  { id: "sessions", label: "Rotating vs sticky sessions" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-16">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-navy-900">
              Documentation
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to connect your application to your proxy
              credentials. Examples below use placeholder credentials — swap
              in the values shown in your dashboard&apos;s Proxy Generator.
            </p>
          </div>

          <section id="getting-started" className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy-900">Getting started</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-navy-700">
              <li>Create an account and purchase a product (Residential, ISP, or Mobile).</li>
              <li>Open <span className="font-medium">Proxy Generator</span> in your dashboard.</li>
              <li>Choose product, location, protocol, and session type, then generate credentials.</li>
              <li>Use the generated host, port, username, and password with any HTTP/HTTPS or SOCKS5-compatible client.</li>
            </ol>
          </section>

          <section id="http-https" className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy-900">HTTP/HTTPS usage</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Point your HTTP client at your gateway hostname with your
              generated username and password as basic auth credentials in
              the proxy URL.
            </p>
            <div className="mt-5">
              <CodeTabs tabs={httpExamples} />
            </div>
          </section>

          <section id="socks5" className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy-900">SOCKS5 usage</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              SOCKS5 credentials use the same gateway hostname on a dedicated
              SOCKS5 port.
            </p>
            <div className="mt-5">
              <CodeTabs tabs={socks5Examples} />
            </div>
          </section>

          <section id="formats" className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy-900">Credential formats</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              The Proxy Generator can export credentials in any of the
              following formats:
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["HOST:PORT:USER:PASS", `${exampleHost}:${gatewayPorts.http}:${exampleUser}:${examplePass}`],
                    ["USER:PASS@HOST:PORT", `${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http}`],
                    ["HTTP URL", `http://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.http}`],
                    ["SOCKS5 URL", `socks5://${exampleUser}:${examplePass}@${exampleHost}:${gatewayPorts.socks5}`],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-t border-border/70 first:border-t-0">
                      <td className="w-48 bg-secondary/50 px-4 py-3 font-medium text-navy-900">
                        {label}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-navy-700">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="sessions" className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy-900">Rotating vs. sticky sessions</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-navy-900">Rotating</span>{" "}
              credentials select a new exit IP on every new connection.{" "}
              <span className="font-medium text-navy-900">Sticky</span>{" "}
              credentials hold the same exit IP for the session duration you
              configure in the Proxy Generator, then rotate automatically once
              it expires.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
