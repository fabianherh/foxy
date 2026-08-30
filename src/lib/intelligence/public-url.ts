function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function normalizePublicUrl(value: string): string {
  const trimmed = value.trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parsePublicUrl(value: string): URL {
  const url = new URL(normalizePublicUrl(value));
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only public HTTP(S) URLs can be analyzed");
  const hostname = url.hostname.toLowerCase();
  const privateName = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal");
  const privateIpv6 = hostname === "::1" || hostname === "[::1]" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:") || hostname.startsWith("[fc") || hostname.startsWith("[fd") || hostname.startsWith("[fe80:");
  if (privateName || privateIpv4(hostname) || privateIpv6) throw new Error("Private URLs cannot be analyzed");
  return url;
}
