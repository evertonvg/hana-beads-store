import "server-only";
import { headers } from "next/headers";

const MAX_IP_LENGTH = 45; // longest textual IPv6 (with IPv4 suffix)

/** First item of a forwarded-for style list, trimmed; null when empty or implausibly long. */
export function parseClientIp(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  if (!first || first.length > MAX_IP_LENGTH) return null;
  return first;
}

/** Client IP from the header named by CLIENT_IP_HEADER (default x-forwarded-for). */
export async function getClientIp(): Promise<string | null> {
  const { env } = await import("@/lib/env");
  const h = await headers();
  return parseClientIp(h.get(env.CLIENT_IP_HEADER));
}
