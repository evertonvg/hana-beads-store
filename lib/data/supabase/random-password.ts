import { randomBytes } from "node:crypto";

/**
 * A throwaway password nobody knows (it replaces an untrusted one; the user sets a new one next).
 * 256 random bits, plus a fixed suffix so it passes any password policy: upper, lower, digit and
 * symbol are always present (base64url alone lacks a symbol about a quarter of the time).
 */
export function randomPassword(): string {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}
