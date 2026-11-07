import "server-only";

import { cookies } from "next/headers";

export const GUEST_ORDERS_COOKIE = "pp_guest_orders";
const MAX_TOKENS = 10;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Guest order tokens stored in the httpOnly cookie (newest last). Bad cookie content gives none. */
export async function readGuestTokens(): Promise<string[]> {
  const raw = (await cookies()).get(GUEST_ORDERS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string").slice(-MAX_TOKENS)
      : [];
  } catch {
    return [];
  }
}

/** Remembers a guest order token (at most 10; the oldest is dropped). Server actions only. */
export async function rememberGuestToken(token: string): Promise<void> {
  const tokens = (await readGuestTokens()).filter((t) => t !== token);
  tokens.push(token);
  (await cookies()).set(GUEST_ORDERS_COOKIE, JSON.stringify(tokens.slice(-MAX_TOKENS)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Forgets every guest order token (sign-out: the next person on this browser must not see them). */
export async function clearGuestTokens(): Promise<void> {
  (await cookies()).set(GUEST_ORDERS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
