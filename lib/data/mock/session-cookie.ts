import { getIronSession, unsealData, type CookieStore, type SessionOptions } from "iron-session";
import { env } from "@/lib/env";

/** Mock adapter only: the Supabase adapter keeps its session in the `@supabase/ssr` cookies. */
export const SESSION_COOKIE = "pp_session";
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
/** Without "manter conectado" the browser drops the cookie on close; this caps the seal anyway. */
export const SHORT_SECONDS = 24 * 60 * 60;

export type SessionPayload = { userId?: string; expiresAt?: number };

export type { CookieStore };

/** `SESSION_SECRET` is only validated as present when `DATA_SOURCE=mock`; this adapter needs it. */
function sessionSecret(): string {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for the mock session");
  return env.SESSION_SECRET;
}

/** Same options everywhere (adapter and proxy). `remember` only matters when saving. */
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

/** The signed-in user id stored in `store`, or null (no cookie, tampered or expired seal). */
export async function readSession(store: CookieStore): Promise<string | null> {
  return liveUserId(await getIronSession<SessionPayload>(store, sessionOptions()));
}

/** Seals `userId` into the session cookie. `remember` keeps it for 30 days. */
export async function writeSession(
  store: CookieStore,
  userId: string,
  remember: boolean,
): Promise<void> {
  const session = await getIronSession<SessionPayload>(store, sessionOptions(remember));
  session.userId = userId;
  session.expiresAt = Date.now() + (remember ? REMEMBER_SECONDS : SHORT_SECONDS) * 1000;
  await session.save();
}

export async function clearSession(store: CookieStore): Promise<void> {
  const session = await getIronSession<SessionPayload>(store, sessionOptions());
  session.destroy();
}
