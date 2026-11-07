"use server";

import { safeNext } from "@/lib/auth/redirect";
import { hasTooManyLines, sanitizeCart } from "@/lib/cart/merge";
import { planCartSync } from "@/lib/cart/sync";
import type { CartData } from "@/lib/cart/types";
import { getData } from "@/lib/data";
import { parseProvider } from "@/lib/auth/providers";
import { publicEnv } from "@/lib/env";
import { clearGuestTokens } from "@/lib/guest-orders";
import { allowAttempt, RATE_LIMITED } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import {
  AUTH_CONSENT_VERSION,
  loginSchema,
  recoverSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";

/**
 * `redirectTo` is already sanitized: the client may navigate to it as is (an external URL only
 * comes from a social sign-in). `unconfirmed` = right password, e-mail not confirmed yet.
 */
export type AuthResult = FormState & { redirectTo?: string; unconfirmed?: boolean };

const BAD_CREDENTIALS = "E-mail ou senha incorretos.";
const UNCONFIRMED = "Confirme seu e-mail para entrar.";
const rateLimited = (): AuthResult => ({ status: "error", message: RATE_LIMITED });

/** Same text whether or not the e-mail has a pending account. */
const RESEND_SENT = "Se houver uma conta pendente, enviamos um novo link.";

/** Where sign-up sends the user: the e-mail is in the URL only to show (masked) and resend. */
function confirmEmailPath(email: string, next: string): string {
  const query = new URLSearchParams({ email });
  if (next !== "/conta") query.set("next", next);
  return `/cadastro/confirme-seu-email?${query.toString()}`;
}

/** Same text for existing and unknown e-mails: never reveal who has an account. */
const RECOVER_SENT = "Se o e-mail estiver cadastrado, você vai receber um link.";

/** `next` travels next to the form values but is not part of the validated schema. */
function nextOf(input: unknown): unknown {
  return typeof input === "object" && input !== null ? (input as { next?: unknown }).next : null;
}

/** Sign in with e-mail and password. Revalidates with the same schema as the client. */
export async function loginAction(input: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: BAD_CREDENTIALS };
  try {
    const { email, password, remember } = parsed.data;
    if (!(await allowAttempt("login", email))) return rateLimited();
    const user = await getData().auth.signIn(email, password, remember);
    if (!user) return { status: "error", message: BAD_CREDENTIALS };
    if ("error" in user) return { status: "error", message: UNCONFIRMED, unconfirmed: true };
    return { status: "ok", redirectTo: safeNext(nextOf(input)) };
  } catch (error) {
    console.error("loginAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Create an account pending e-mail confirmation (consents recorded with the version of the text shown). */
export async function signupAction(input: unknown): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    const { name, email, phone, password, marketingEmail } = parsed.data;
    if (!(await allowAttempt("cadastro", email))) return rateLimited();
    const next = safeNext(nextOf(input));
    // Same answer whether or not the e-mail already had an account: no session until confirmed.
    await getData().auth.signUp(
      {
        name,
        email,
        phone,
        password,
        marketingEmail,
        acceptTerms: true,
        termsVersion: AUTH_CONSENT_VERSION,
      },
      next,
    );
    return { status: "ok", redirectTo: confirmEmailPath(email, next) };
  } catch (error) {
    console.error("signupAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/**
 * "REENVIAR LINK" (confirmation screen and unconfirmed login). The answer never says whether the
 * e-mail has a pending account; a malformed e-mail gets the same answer without a send.
 */
export async function resendConfirmationAction(email: unknown, next: unknown): Promise<FormState> {
  const parsed = recoverSchema.safeParse({ email });
  try {
    if (!(await allowAttempt("reenvio", parsed.success ? parsed.data.email : null))) {
      return rateLimited();
    }
    if (parsed.success) await getData().auth.resendConfirmation(parsed.data.email, safeNext(next));
  } catch (error) {
    console.error("resendConfirmationAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  return { status: "ok", message: RESEND_SENT };
}

/**
 * Social sign-in: returns the provider URL to navigate to (the mock's lands on /auth/callback).
 * Not rate limited here: the provider does its own checks.
 */
export async function socialAction(provider: string, next: unknown): Promise<AuthResult> {
  const allowed = parseProvider(provider, publicEnv.authApple);
  if (!allowed) {
    return { status: "error", message: GENERIC_ERROR };
  }
  try {
    const { url } = await getData().auth.signInWithProvider(allowed, safeNext(next));
    return { status: "ok", redirectTo: url };
  } catch (error) {
    console.error("socialAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** "Esqueci minha senha": the answer is the same for every well-formed e-mail. */
export async function recoverAction(input: unknown): Promise<FormState> {
  const parsed = recoverSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    if (!(await allowAttempt("recuperacao", parsed.data.email))) return rateLimited();
    await getData().auth.requestPasswordReset(parsed.data.email);
  } catch (error) {
    console.error("recoverAction failed", error);
  }
  return { status: "ok", message: RECOVER_SENT };
}

/** Drops lines whose product no longer exists in the catalog. */
async function knownLines(lines: CartData["lines"]): Promise<CartData> {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const known = new Set((await getData().catalog.byIds(ids)).map((p) => p.id));
  return { lines: lines.filter((l) => known.has(l.productId)) };
}

/**
 * Right after sign-in: reconciles the local cart with the one saved on the server (`planCartSync`:
 * summed for a guest cart or another user's, the local one when `owner` is this same user), saves
 * the result and returns it, with the user id to mark as owner, so the client can replace its
 * store. Null without a session.
 */
export async function syncCartAction(
  lines: unknown,
  owner: unknown,
): Promise<(CartData & { owner: string }) | null> {
  const session = await getSession();
  if (!session) return null;
  const { auth } = getData();
  const local = hasTooManyLines(lines) ? { lines: [] } : sanitizeCart({ lines });
  const saved = (await auth.savedCart(session.id)) ?? { lines: [] };
  const planned = planCartSync(local, typeof owner === "string" ? owner : null, session.id, saved);
  const result = await knownLines(planned.lines);
  await auth.saveCart(session.id, result);
  return { ...result, owner: session.id };
}

/**
 * Saves the cart edits made while signed in. The user comes only from the session (never from the
 * client); without a session the call does nothing.
 */
export async function saveCartAction(lines: unknown): Promise<void> {
  const session = await getSession();
  if (!session || hasTooManyLines(lines)) return;
  await getData().auth.saveCart(session.id, await knownLines(sanitizeCart({ lines }).lines));
}

/**
 * Sign-out: ends the session and forgets the guest order tokens, so the next person on this
 * browser cannot open those orders. The client also releases its cart (`useCartStore.release`).
 */
export async function logoutAction(): Promise<void> {
  await getData().auth.signOut();
  await clearGuestTokens();
}
