import "server-only";

import { createHash } from "node:crypto";

import { getClientIp } from "@/lib/client-ip";
import { getData } from "@/lib/data";

/** Server actions that count attempts (each one has its own counters). */
export type RateLimitAction =
  "login" | "cadastro" | "reenvio" | "recuperacao" | "newsletter" | "aviso_estoque";

/** Fixed windows: 5 attempts per e-mail and 20 per IP every 15 minutes, for each action. */
export const RATE_LIMITS = {
  perEmail: { max: 5, windowSeconds: 900 },
  perIp: { max: 20, windowSeconds: 900 },
} as const;

/** One message whichever key ran out: never tell which. */
export const RATE_LIMITED = "Muitas tentativas. Tente de novo em alguns minutos.";

/**
 * Counts one attempt of `action` under `ip:<action>:<ip>` and `email:<action>:<sha256>`, the hex
 * SHA-256 of the normalized e-mail: keys stay short whatever the e-mail length (the column allows
 * 200 chars, an e-mail up to 254) and the table holds no e-mail addresses. Without an IP (no proxy header) only the e-mail key is counted, and without an
 * e-mail only the IP one. Both keys are always consumed; false = at least one is over its limit
 * and the caller must refuse before calling the port.
 */
export async function allowAttempt(
  action: RateLimitAction,
  email: string | null,
): Promise<boolean> {
  const { rateLimit } = getData();
  const ip = await getClientIp();
  const hits: Promise<boolean>[] = [];
  if (ip) {
    const { max, windowSeconds } = RATE_LIMITS.perIp;
    hits.push(rateLimit.hit(`ip:${action}:${ip}`, max, windowSeconds));
  }
  const normalized = email?.trim().toLowerCase();
  if (normalized) {
    const { max, windowSeconds } = RATE_LIMITS.perEmail;
    const digest = createHash("sha256").update(normalized).digest("hex");
    hits.push(rateLimit.hit(`email:${action}:${digest}`, max, windowSeconds));
  }
  return (await Promise.all(hits)).every(Boolean);
}
