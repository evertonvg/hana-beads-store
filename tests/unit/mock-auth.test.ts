import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAuth } from "@/lib/data/mock/auth";
import { createMockRateLimit } from "@/lib/data/mock/rate-limit";
import { getMockStore } from "@/lib/data/mock/store";
import { MARKETING_CONSENT_VERSION } from "@/lib/validation/account";

import { memoryCookies, mockAuthInJar } from "./memory-cookies";

// Shared behaviour (confirmation, sessions, recovery) lives in tests/contract/auth.contract.ts.

const newUser = {
  name: "Nova Pessoa",
  email: "Nova@Teste.dev",
  phone: "(11) 91234-5678",
  password: "Senha@123",
  acceptTerms: true as const,
  marketingEmail: false,
  termsVersion: "2026-10-28",
};

const pendingId = async (over: object = {}) => {
  const r = await mockAuthInJar().signUp({ ...newUser, ...over }, "/conta");
  if (!r.userId) throw new Error("unexpected existing account");
  return r.userId;
};

describe("mock auth", () => {
  beforeEach(() => getMockStore().reset());

  it("keeps the new account pending, with the e-mail normalized, and links to /auth/confirm", async () => {
    const id = await pendingId();
    const store = getMockStore();
    expect(store.pendingUsers).toMatchObject([{ id, email: "nova@teste.dev" }]);
    expect(store.users.some((u) => u.id === id)).toBe(false);
    const [mail] = store.inbox;
    expect(mail).toMatchObject({ to: "nova@teste.dev", kind: "confirmacao" });
    expect(mail?.link).toMatch(
      /^\/auth\/confirm\?token_hash=[0-9a-f-]{36}&type=email&next=%2Fconta$/,
    );
  });

  it("signing up again before confirming sends a new link for the same account", async () => {
    const id = await pendingId();
    expect(await pendingId()).toBe(id);
    expect(getMockStore().inbox).toHaveLength(2);
  });

  it("resends the confirmation only to pending accounts", async () => {
    await pendingId();
    const auth = mockAuthInJar();
    await auth.resendConfirmation(" NOVA@teste.dev ", "/loja");
    await auth.resendConfirmation("ana@teste.dev", "/loja");
    await auth.resendConfirmation("ninguem@teste.dev", "/loja");
    const inbox = getMockStore().inbox;
    expect(inbox.map((m) => m.to)).toEqual(["nova@teste.dev", "nova@teste.dev"]);
    expect(inbox[1]?.link).toContain("next=%2Floja");
  });

  it("sends the recovery link to /redefinir-senha and refuses it as a confirmation", async () => {
    const auth = mockAuthInJar();
    await auth.requestPasswordReset("ana@teste.dev");
    const [mail] = getMockStore().inbox;
    expect(mail?.kind).toBe("recuperacao");
    expect(mail?.link).toContain("next=%2Fredefinir-senha");
    const token = new URL(mail?.link ?? "", "http://x.invalid").searchParams.get("token_hash");
    expect(await auth.verifyEmailLink(token ?? "", "email")).toEqual({ ok: false });
  });

  it("records terms and privacy consent at sign-up, plus marketing only when checked", async () => {
    const a = await pendingId();
    const b = await pendingId({ email: "b@teste.dev", marketingEmail: true });
    const types = (id: string) =>
      getMockStore()
        .consents.filter((c) => c.userId === id)
        .map((c) => [c.type, c.version]);
    expect(types(a)).toEqual([
      ["terms", "2026-10-28"],
      ["privacy", "2026-10-28"],
    ]);
    expect(types(b)).toEqual([
      ["terms", "2026-10-28"],
      ["privacy", "2026-10-28"],
      ["email_marketing", "2026-10-28"],
    ]);
  });

  it("records the marketing consent with the marketing text version", async () => {
    await pendingId({ marketingEmail: true, termsVersion: "2020-01-01" });
    const marketing = getMockStore().consents.find((c) => c.type === "email_marketing");
    expect(marketing?.version).toBe(MARKETING_CONSENT_VERSION);
    const terms = getMockStore().consents.find((c) => c.type === "terms");
    expect(terms?.version).toBe("2020-01-01");
  });

  it("gives a provider URL on /auth/callback, and the mock code signs in as ana", async () => {
    const auth = mockAuthInJar();
    expect(await auth.signInWithProvider("google", "/loja?x=1")).toEqual({
      url: "/auth/callback?code=mock-google&next=%2Floja%3Fx%3D1",
    });
    expect(await auth.completeOAuth("outro")).toBe(false);
    expect(await auth.currentUser()).toBeNull();
    expect(await auth.completeOAuth("mock-google")).toBe(true);
    expect((await auth.currentUser())?.id).toBe("ana");
  });

  it("without remember the cookie is a browser session; with it, about 30 days", async () => {
    const options: { maxAge?: number; httpOnly?: boolean; sameSite?: string }[] = [];
    const cookies = memoryCookies();
    const spy = {
      ...cookies,
      set: (n: string, v: string, o: { maxAge?: number }) => {
        options.push(o);
        cookies.set(n, v, o);
      },
    };
    const auth = createMockAuth({ cookies: () => Promise.resolve(spy) });
    await auth.signIn("ana@teste.dev", "Senha@123", false);
    await auth.signIn("ana@teste.dev", "Senha@123", true);
    expect(options[0]).toMatchObject({ httpOnly: true, sameSite: "lax" });
    expect(options[0]?.maxAge).toBeUndefined();
    expect(options[1]?.maxAge).toBeGreaterThan(29 * 24 * 60 * 60);
    expect(options[1]?.maxAge).toBeLessThanOrEqual(30 * 24 * 60 * 60);
  });

  it("is signed out once the account is deleted", async () => {
    const auth = mockAuthInJar();
    await auth.signIn("bruno@teste.dev", "Senha@123", false);
    const store = getMockStore();
    store.users = store.users.filter((u) => u.id !== "bruno");
    expect(await auth.currentUser()).toBeNull();
  });

  it("keeps ana's saved cart in the fixtures and saves per user", async () => {
    const port = mockAuthInJar();
    expect(await port.savedCart("ana")).toEqual({
      lines: [{ productId: "e13", ring: "mosquetao", qty: 1 }],
    });
    expect(await port.savedCart("bruno")).toBeNull();
    await port.saveCart("bruno", { lines: [{ productId: "garota", ring: "estrela", qty: 2 }] });
    expect(await port.savedCart("bruno")).toEqual({
      lines: [{ productId: "garota", ring: "estrela", qty: 2 }],
    });
  });

  it("never reuses the id of a deleted user", async () => {
    const first = await pendingId();
    const store = getMockStore();
    store.pendingUsers = store.pendingUsers.filter((u) => u.id !== first);
    expect(await pendingId({ email: "outra@teste.dev" })).not.toBe(first);
  });

  it("reset clears pending accounts, the inbox and the tokens", async () => {
    await pendingId();
    getMockStore().reset();
    const store = getMockStore();
    expect(store.pendingUsers).toEqual([]);
    expect(store.inbox).toEqual([]);
    expect(store.emailTokens).toEqual({});
  });
});

describe("mock rate limit", () => {
  beforeEach(() => getMockStore().reset());
  afterEach(() => vi.useRealTimers());

  it("allows max hits per key in a fixed window, then refuses until the next one", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-07T12:00:00Z") });
    const limit = createMockRateLimit();
    const hits = [];
    for (let i = 0; i < 3; i++) hits.push(await limit.hit("email:login:a", 2, 900));
    expect(hits).toEqual([true, true, false]);
    expect(await limit.hit("email:login:b", 2, 900)).toBe(true);
    vi.setSystemTime(new Date("2026-11-07T12:15:00Z"));
    expect(await limit.hit("email:login:a", 2, 900)).toBe(true);
  });

  it("is cleared by the store reset", async () => {
    const limit = createMockRateLimit();
    expect(await limit.hit("k", 1, 900)).toBe(true);
    expect(await limit.hit("k", 1, 900)).toBe(false);
    getMockStore().reset();
    expect(await limit.hit("k", 1, 900)).toBe(true);
  });
});
