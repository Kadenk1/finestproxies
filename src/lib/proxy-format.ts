export type ProxyOutputFormat = "HOST_PORT_USER_PASS" | "USER_PASS_HOST_PORT" | "URL";

export interface FormattableCredential {
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
}

export const formatLabels: Record<ProxyOutputFormat, string> = {
  HOST_PORT_USER_PASS: "HOST:PORT:USER:PASS",
  USER_PASS_HOST_PORT: "USER:PASS@HOST:PORT",
  URL: "URL",
};

export function formatCredential(cred: FormattableCredential, format: ProxyOutputFormat): string {
  const { host, port, username, password, protocol } = cred;
  switch (format) {
    case "HOST_PORT_USER_PASS":
      return `${host}:${port}:${username}:${password}`;
    case "USER_PASS_HOST_PORT":
      return `${username}:${password}@${host}:${port}`;
    case "URL": {
      const scheme = protocol === "SOCKS5" ? "socks5" : "http";
      return `${scheme}://${username}:${password}@${host}:${port}`;
    }
  }
}

export function urlFormatLabel(protocol: "HTTP" | "HTTPS" | "SOCKS5"): string {
  return protocol === "SOCKS5" ? "SOCKS5 URL" : "HTTP URL";
}
