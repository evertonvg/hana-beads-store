import {
  AuthUnknownError,
  isAuthApiError,
  isAuthRetryableFetchError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies as nextCookies } from "next/headers";
import { randomBytes } from "node:crypto";

import type { CartData } from "@/lib/cart/types";
import type { AuthPort, AuthUser, SignUpInput } from "@/lib/data/ports";
import type { Database, Json } from "@/lib/supabase/database.types";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from "@/lib/supabase/remember";
import { MARKETING_CONSENT_VERSION } from "@/lib/validation/account";

import { toPortError } from "./errors";

type Client = SupabaseClient<Database>;

/** The bit of the request cookie store this adapter writes (the `pp_remember` choice). */
export type RememberCookieStore = {
  set(
    name: string,
    value: string,
    options?: {
      maxAge?: number;
      httpOnly?: boolean;
      sameSite?: "lax";
      secure?: boolean;
      path?: string;
    },
  ): unknown;
};

export type SupabaseAuthDeps = {
  /** Publishable-key, cookie-bound client: sessions and every data query (RLS applies). */
  getClient: () => Promise<Client>;
  /** Secret-key, cookie-bound client: ONLY rate-limited `auth.*` calls (forwards the user's IP). */
  getAuthClient: () => Promise<Client>;
  /** Secret-key client without cookies: pending-account lookup, re-sign-up flag, admin updates. */
  getAdminClient: () => Client;
  /** Public site origin for e-mail and OAuth redirects, e.g. "http://localhost:3000". */
  siteUrl: string;
  /** Request cookies; defaults to `next/headers`. Tests pass an in-memory jar per "browser". */
  cookies?: () => Promise<RememberCookieStore>;
};

const normalize = (email: string) => email.trim().toLowerCase();

/** app_metadata key: the pending account was signed up again (only the admin API can set it). */
const RESIGNUP_FLAG = "resignup";

/** Where the recovery link lands (the new-password screen). */
const RECOVERY_NEXT = "/redefinir-senha";

/**
 * Network failures and 5xx are infrastructure (they throw); any other auth error is an expected
 * answer (bad token, no session, revoked session…) that the port turns into a typed value.
 */
function isInfraError(e: unknown): boolean {
  return (
    isAuthRetryableFetchError(e) ||
    e instanceof AuthUnknownError ||
    (isAuthApiError(e) && e.status >= 500)
  );
}

/**
 * Sign-up data saved by the `handle_new_user` trigger. `withNulls` sends absent fields as null:
 * the admin API merges metadata and only a null removes a key left by an earlier sign-up.
 */
function signUpMetadata(i: SignUpInput, withNulls: boolean): Record<string, Json> {
  const optional = { cpf: i.cpf ?? null, address: (i.address as Json | undefined) ?? null };
  return {
    name: i.name,
    phone: i.phone,
    terms_version: i.termsVersion,
    marketing_email: i.marketingEmail,
    marketing_version: MARKETING_CONSENT_VERSION,
    ...(withNulls
      ? optional
      : Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== null))),
  };
}

/**
 * Auth on Supabase with e-mail confirmation. The session lives in the `@supabase/ssr` cookies,
 * written by the injected clients; this adapter only adds `pp_remember` ("manter conectado").
 */
export function createSupabaseAuth(deps: SupabaseAuthDeps): AuthPort {
  const cookieStore = deps.cookies ?? nextCookies;
  const confirmUrl = (next: string) =>
    `${deps.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;

  /** Must run BEFORE creating the clients: they read the choice once, when created. */
  async function setRemember(remember: boolean) {
    const store = await cookieStore();
    if (remember) {
      store.set(REMEMBER_COOKIE, "1", {
        maxAge: REMEMBER_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    } else {
      store.set(REMEMBER_COOKIE, "", { maxAge: 0, path: "/" });
    }
  }

  /** The profile name through the publishable client, so RLS limits it to the user's own row. */
  async function profileName(userId: string): Promise<string | null> {
    const { data, error } = await (
      await deps.getClient()
    )
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    if (error) toPortError(error);
    return data?.name ?? null;
  }

  async function toAuthUser(user: { id: string; email?: string }): Promise<AuthUser | null> {
    const name = await profileName(user.id);
    if (name === null) return null;
    return { id: user.id, name, email: user.email ?? "" };
  }

  return {
    async signIn(email, password, remember) {
      await setRemember(remember);
      const auth = await deps.getAuthClient();
      const { data, error } = await auth.auth.signInWithPassword({
        email: normalize(email),
        password,
      });
      if (error) {
        await setRemember(false);
        if (error.code === "email_not_confirmed") return { error: "email_nao_confirmado" };
        if (error.code === "invalid_credentials") return null;
        toPortError(error);
      }
      const user = await toAuthUser(data.user);
      if (!user) {
        // Signed in but without a profile: treat as a missing account.
        await (await deps.getClient()).auth.signOut({ scope: "local" });
        await setRemember(false);
      }
      return user;
    },

    async signUp(input, next) {
      const email = normalize(input.email);
      const admin = deps.getAdminClient();

      // GoTrue keeps the first comer's password and data when an unconfirmed e-mail signs up again
      // (it only re-sends the e-mail). Take the latest data, but trust neither password: flag the
      // account so that confirming it scrambles the password (see verifyEmailLink).
      const pending = await admin.rpc("pending_user_id", { p_email: email });
      if (pending.error) toPortError(pending.error);
      const pendingId = pending.data as string | null;
      if (pendingId) {
        const { error } = await admin.auth.admin.updateUserById(pendingId, {
          app_metadata: { [RESIGNUP_FLAG]: true },
          user_metadata: signUpMetadata(input, true),
        });
        if (error) toPortError(error);
      }

      const auth = await deps.getAuthClient();
      const { data, error } = await auth.auth.signUp({
        email,
        password: input.password,
        options: { emailRedirectTo: confirmUrl(next), data: signUpMetadata(input, false) },
      });
      if (error) {
        if (error.code === "user_already_exists" || error.code === "email_exists") {
          return { status: "confirmacao_pendente", userId: null };
        }
        // An e-mail went out moments ago (the latest one still confirms a pending account). Same
        // answer for a new or a pending e-mail, so the response tells nothing about the account.
        if (error.code === "over_email_send_rate_limit") {
          return { status: "confirmacao_pendente", userId: pendingId };
        }
        toPortError(error);
      }
      const userId = data.user?.identities?.length ? data.user.id : null;
      return { status: "confirmacao_pendente", userId };
    },

    async signInWithProvider(provider, next) {
      const { data, error } = await (
        await deps.getClient()
      ).auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${deps.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
        },
      });
      if (error) toPortError(error);
      return { url: data.url };
    },

    async completeOAuth(code) {
      const { error } = await (await deps.getClient()).auth.exchangeCodeForSession(code);
      if (error && isInfraError(error)) toPortError(error);
      return !error;
    },

    async verifyEmailLink(tokenHash, type) {
      const client = await deps.getClient();
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        if (isInfraError(error)) toPortError(error);
        return { ok: false };
      }
      const { user } = data;
      if (type !== "email" || !user || user.app_metadata[RESIGNUP_FLAG] !== true) {
        return { ok: true, mustSetPassword: false };
      }
      // Signed up again while pending: nobody's password is trusted. Replace it with a random one
      // from this session (GoTrue then ends every OTHER session; the admin API would end this one
      // too), clear the flag, and let the user choose a password here.
      const upd = await client.auth.updateUser({ password: randomBytes(32).toString("base64url") });
      if (upd.error) toPortError(upd.error);
      const out = await client.auth.signOut({ scope: "others" });
      if (out.error) toPortError(out.error);
      const flag = await deps.getAdminClient().auth.admin.updateUserById(user.id, {
        app_metadata: { [RESIGNUP_FLAG]: null },
      });
      if (flag.error) toPortError(flag.error);
      return { ok: true, mustSetPassword: true };
    },

    async resendConfirmation(email, next) {
      const { error } = await (
        await deps.getAuthClient()
      ).auth.resend({
        type: "signup",
        email: normalize(email),
        options: { emailRedirectTo: confirmUrl(next) },
      });
      // Same answer whether or not there is a pending account, or an e-mail went out moments ago.
      if (error && error.code !== "user_not_found" && error.code !== "over_email_send_rate_limit") {
        toPortError(error);
      }
    },

    async requestPasswordReset(email) {
      const { error } = await (
        await deps.getAuthClient()
      ).auth.resetPasswordForEmail(normalize(email), {
        redirectTo: `${deps.siteUrl}/auth/confirm?next=${RECOVERY_NEXT}`,
      });
      if (error && error.code !== "user_not_found" && error.code !== "over_email_send_rate_limit") {
        toPortError(error);
      }
    },

    async updatePassword(password) {
      const client = await deps.getClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        if (isInfraError(error)) toPortError(error);
        return { ok: false };
      }
      const out = await client.auth.signOut({ scope: "others" });
      if (out.error) toPortError(out.error);
      return { ok: true };
    },

    async signOut() {
      // "local": revokes this session only (the default "global" would end every device).
      const { error } = await (await deps.getClient()).auth.signOut({ scope: "local" });
      await setRemember(false);
      if (error && isInfraError(error)) toPortError(error);
    },

    async currentUser() {
      const { data, error } = await (await deps.getClient()).auth.getUser();
      if (error) {
        if (isInfraError(error)) toPortError(error);
        return null;
      }
      return toAuthUser(data.user);
    },

    async savedCart(userId) {
      const { data, error } = await (
        await deps.getClient()
      )
        .from("saved_carts")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) toPortError(error);
      return data ? (data.data as unknown as CartData) : null;
    },

    async saveCart(userId, cart) {
      const { error } = await (await deps.getClient()).from("saved_carts").upsert({
        user_id: userId,
        data: cart as unknown as NonNullable<Json>,
        updated_at: new Date().toISOString(),
      });
      if (error) toPortError(error);
    },
  };
}
