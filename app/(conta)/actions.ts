"use server";

import { safeNext } from "@/lib/auth/redirect";
import { hasTooManyLines, sanitizeCart } from "@/lib/cart/merge";
import { planCartSync } from "@/lib/cart/sync";
import type { CartData } from "@/lib/cart/types";
import { getData } from "@/lib/data";
import { parseProvider } from "@/lib/auth/providers";
import { publicEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  AUTH_CONSENT_VERSION,
  loginSchema,
  recoverSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";

/** `redirectTo` is already sanitized: the client may navigate to it as is. */
export type AuthResult = FormState & { redirectTo?: string };

const BAD_CREDENTIALS = "E-mail ou senha incorretos.";

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
    const user = await getData().auth.signIn(email, password, remember);
    // An unconfirmed e-mail gets the generic error for now (the resend flow is a later task).
    if (!user || "error" in user) return { status: "error", message: BAD_CREDENTIALS };
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
    return { status: "ok", redirectTo: next };
  } catch (error) {
    console.error("signupAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Social sign-in: returns the provider URL to navigate to (the mock's lands on /auth/callback). */
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

/** Sign-out: ends the session. The client also releases its cart (`useCartStore.release`). */
export async function logoutAction(): Promise<void> {
  await getData().auth.signOut();
}
