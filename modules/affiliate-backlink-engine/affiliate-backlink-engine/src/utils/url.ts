/**
 * URL utilities: normalization, validation, SSRF-aware safety.
 *
 * We never actually fetch URLs in this engine by default. When an adapter
 * DOES fetch, it MUST go through these helpers.
 */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // cloud metadata
  "metadata.google.internal"
]);

const PRIVATE_IP_REGEX =
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|255\.|127\.)/;

export interface NormalizedUrl {
  href: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  /** Root domain (best-effort, last two labels). */
  rootDomain: string;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(s: string, opts: { stripHash?: boolean; stripQuery?: boolean } = {}): NormalizedUrl | undefined {
  if (!s || typeof s !== "string") return undefined;
  let url: URL;
  try {
    url = new URL(s.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (opts.stripHash) url.hash = "";
  if (opts.stripQuery) url.search = "";
  // Lowercase host, remove default ports.
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  // Remove trailing slash from path (except root).
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  const rootDomain = extractRootDomain(url.hostname);
  return {
    href: url.href,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    rootDomain
  };
}

export function extractRootDomain(hostname: string): string {
  // Best-effort: last two labels. Handles "www.example.com" -> "example.com".
  // For co.uk etc. we keep it simple; provider adapters can refine.
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

export function isSsrfSafe(s: string): boolean {
  const n = normalizeUrl(s);
  if (!n) return false;
  if (BLOCKED_HOSTS.has(n.hostname)) return false;
  if (PRIVATE_IP_REGEX.test(n.hostname)) return false;
  // Block IPv6 loopback / link-local (rough).
  if (n.hostname.startsWith("fe80:") || n.hostname.startsWith("fc") || n.hostname.startsWith("fd")) return false;
  return true;
}

export function sameDomain(a: string, b: string): boolean {
  const na = normalizeUrl(a);
  const nb = normalizeUrl(b);
  if (!na || !nb) return false;
  return na.rootDomain === nb.rootDomain;
}
