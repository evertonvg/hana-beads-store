import { cookies as nextCookies } from "next/headers";

import type { AuthPort, AuthUser, EmailLinkType, SignUpInput } from "@/lib/data/ports";
import { MARKETING_CONSENT_VERSION } from "@/lib/validation/account";

import type { MockUser } from "./fixtures";
import { clearSession, readSession, writeSession, type CookieStore } from "./session-cookie";
import { getMockStore, type MockInboxMessage, type MockStore } from "./store";

const normalize = (email: string) => email.trim().toLowerCase();
const toUser = ({ id, name, email }: MockUser): AuthUser => ({ id, name, email });

/** Where the recovery link lands (the new-password screen). */
const RECOVERY_NEXT = "/redefinir-senha";
const OAUTH_CODE = /^mock-(google|facebook|apple)$/;

export type MockAuthDeps = {
  /** Request cookies; defaults to `next/headers`. Tests pass an in-memory jar per "browser". */
  cookies?: () => Promise<CookieStore>;
};

/** Sends a single-use link (what Supabase Auth would e-mail). */
function sendLink(store: MockStore, user: MockUser, type: EmailLinkType, next: string) {
  const token = crypto.randomUUID();
  store.emailTokens[token] = { userId: user.id, type };
  const query = new URLSearchParams({ token_hash: token, type, next });
  const kind: MockInboxMessage["kind"] = type === "email" ? "confirmacao" : "recuperacao";
  store.inbox.push({ to: user.email, kind, link: `/auth/confirm?${query.toString()}` });
}

/** Profile data the Supabase trigger saves at sign-up: consents, CPF and the checkout address. */
function recordSignUpData(store: MockStore, user: MockUser, input: SignUpInput) {
  if (input.address) {
    store.addresses[user.id] = [{ ...input.address, id: crypto.randomUUID(), isDefault: true }];
  }
  const grantedAt = new Date().toISOString();
  const grant = (type: "terms" | "privacy" | "email_marketing", version = input.termsVersion) =>
    store.consents.push({
      userId: user.id,
      type,
      version,
      granted: true,
      grantedAt,
      revokedAt: null,
    });
  grant("terms");
  grant("privacy");
  if (input.marketingEmail) grant("email_marketing", MARKETING_CONSENT_VERSION);
}

/**
 * In-memory auth with e-mail confirmation. The session is an iron-session seal holding the user
 * id, kept by this adapter in the `pp_session` cookie.
 */
export function createMockAuth(deps: MockAuthDeps = {}): AuthPort {
  const cookieStore = deps.cookies ?? nextCookies;

  return {
    async signIn(email, password, remember) {
      const store = getMockStore();
      const key = normalize(email);
      const user = store.users.find((u) => u.email === key);
      if (user && user.password === password) {
        await writeSession(await cookieStore(), user.id, remember);
        return toUser(user);
      }
      const pending = store.pendingUsers.find((u) => u.email === key);
      if (pending && pending.password === password) return { error: "email_nao_confirmado" };
      return null;
    },

    signUp(input, next) {
      const store = getMockStore();
      const email = normalize(input.email);
      if (store.users.some((u) => u.email === email)) {
        return Promise.resolve({ status: "confirmacao_pendente", userId: null });
      }
      const pending = store.pendingUsers.find((u) => u.email === email);
      if (pending) {
        // Like the Supabase adapter: the latest sign-up replaces the data but NOT the password, and
        // flags the account so confirming it scrambles the password (nobody's password survives).
        // A new link replaces the old ones.
        pending.name = input.name.trim();
        pending.phone = input.phone;
        pending.resignup = true;
        if (input.cpf) pending.cpf = input.cpf;
        else delete pending.cpf;
        store.consents = store.consents.filter((c) => c.userId !== pending.id);
        delete store.addresses[pending.id];
        for (const [token, link] of Object.entries(store.emailTokens)) {
          if (link.userId === pending.id) delete store.emailTokens[token];
        }
        recordSignUpData(store, pending, input);
        sendLink(store, pending, "email", next);
        return Promise.resolve({ status: "confirmacao_pendente", userId: pending.id });
      }
      const user: MockUser = {
        // Never derived from the user count: a deleted user's id must not come back.
        id: crypto.randomUUID(),
        name: input.name.trim(),
        email,
        phone: input.phone,
        password: input.password,
        ...(input.cpf ? { cpf: input.cpf } : {}),
      };
      store.pendingUsers.push(user);
      recordSignUpData(store, user, input);
      sendLink(store, user, "email", next);
      return Promise.resolve({ status: "confirmacao_pendente", userId: user.id });
    },

    signInWithProvider(provider, next) {
      const query = new URLSearchParams({ code: `mock-${provider}`, next });
      return Promise.resolve({ url: `/auth/callback?${query.toString()}` });
    },

    async completeOAuth(code) {
      // The mock has no real OAuth: every provider logs in as the "ana" fixture.
      if (!OAUTH_CODE.test(code)) return false;
      const ana = getMockStore().users.find((u) => u.id === "ana");
      if (!ana) return false;
      await writeSession(await cookieStore(), ana.id, false);
      return true;
    },

    async verifyEmailLink(tokenHash, type) {
      const store = getMockStore();
      const token = store.emailTokens[tokenHash];
      if (!token || token.type !== type) return { ok: false };
      delete store.emailTokens[tokenHash];
      if (type === "email") {
        const i = store.pendingUsers.findIndex((u) => u.id === token.userId);
        if (i >= 0) store.users.push(...store.pendingUsers.splice(i, 1));
      }
      const user = store.users.find((u) => u.id === token.userId);
      if (!user) return { ok: false };
      const mustSetPassword = type === "email" && user.resignup === true;
      if (mustSetPassword) {
        user.password = crypto.randomUUID();
        delete user.resignup;
      }
      await writeSession(await cookieStore(), user.id, false);
      return { ok: true, mustSetPassword };
    },

    resendConfirmation(email, next) {
      const store = getMockStore();
      const pending = store.pendingUsers.find((u) => u.email === normalize(email));
      if (pending) sendLink(store, pending, "email", next);
      return Promise.resolve();
    },

    requestPasswordReset(email) {
      const store = getMockStore();
      const user = store.users.find((u) => u.email === normalize(email));
      if (user) sendLink(store, user, "recovery", RECOVERY_NEXT);
      return Promise.resolve();
    },

    async updatePassword(next) {
      // The mock seals cannot be revoked, so "sign the other sessions out" is not simulated.
      const userId = await readSession(await cookieStore());
      const user = userId ? getMockStore().users.find((u) => u.id === userId) : undefined;
      if (!user) return { ok: false };
      user.password = next;
      return { ok: true };
    },

    async signOut() {
      await clearSession(await cookieStore());
    },

    async currentUser() {
      const userId = await readSession(await cookieStore());
      const user = userId ? getMockStore().users.find((u) => u.id === userId) : undefined;
      return user ? toUser(user) : null;
    },

    savedCart(userId) {
      const cart = getMockStore().savedCarts[userId];
      return Promise.resolve(cart ? structuredClone(cart) : null);
    },

    saveCart(userId, cart) {
      getMockStore().savedCarts[userId] = structuredClone(cart);
      return Promise.resolve();
    },
  };
}
