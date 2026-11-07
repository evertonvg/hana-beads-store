import { unsealData, type SessionOptions } from "iron-session";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "pp_session";
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
/** Without "manter conectado" the browser drops the cookie on close; this caps the seal anyway. */
export const SHORT_SECONDS = 24 * 60 * 60;

export type SessionPayload = { userId?: string; expiresAt?: number };

/** `SESSION_SECRET` is only validated as present when `DATA_SOURCE=mock`; this adapter needs it. */
function sessionSecret(): string {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for the mock session");
  return env.SESSION_SECRET;
}

/** Same options everywhere (server components, actions and the proxy). `remember` only matters when saving. */
export function sessionOptions(remember = false): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: sessionSecret(),
    ttl: remember ? REMEMBER_SECONDS : 0,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // maxAge: undefined = session cookie (iron-session would otherwise set one from the ttl).
      ...(remember ? {} : { maxAge: undefined }),
    },
  };
}

/** The user id of a payload that has not expired; null otherwise. */
export function liveUserId(payload: SessionPayload): string | null {
  const { userId, expiresAt } = payload;
  if (typeof userId !== "string" || userId === "") return null;
  if (typeof expiresAt !== "number" || expiresAt <= Date.now()) return null;
  return userId;
}

/** Opens a raw cookie value (no `next/headers`, so the proxy can use it). Tampered or expired gives null. */
export async function userIdFromSeal(seal: string | undefined): Promise<string | null> {
  if (!seal) return null;
  try {
    const payload = await unsealData<SessionPayload>(seal, { password: sessionSecret() });
    return liveUserId(payload);
  } catch {
    return null;
  }
}
