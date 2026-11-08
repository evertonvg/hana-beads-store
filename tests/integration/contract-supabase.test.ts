import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartData } from "@/lib/cart/types";
import { createSupabaseAuth } from "@/lib/data/supabase/auth";
import {
  createSupabaseAccountReads,
  NotAvailableYetError,
} from "@/lib/data/supabase/account-reads";
import { createSupabaseEngagement } from "@/lib/data/supabase/engagement";
import { createSupabaseNewsletter } from "@/lib/data/supabase/newsletter";
import { createSupabaseRateLimit } from "@/lib/data/supabase/rate-limit";
import { createSupabaseCatalog } from "@/lib/data/supabase/catalog";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from "@/lib/supabase/remember";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import { describeAuthContract } from "../contract/auth.contract";
import { describeCatalogContract } from "../contract/catalog.contract";
import { describeEngagementContract } from "../contract/engagement.contract";
import { describeNewsletterContract } from "../contract/newsletter.contract";
import { describeRateLimitContract } from "../contract/rate-limit.contract";
import { supabaseIds } from "../contract/fixture-ids";
import { clearInbox, latestLink, readInbox } from "./mailpit";
import {
  addFillerProducts,
  cookieJar,
  jarClient,
  resetAuth,
  resetDb,
  serviceClient,
  setPrices,
  signedInClient,
} from "./support";

describeCatalogContract(
  {
    name: "supabase",
    make: () => createSupabaseCatalog({ getClient: createSupabasePublicClient }),
    reset: resetDb,
    addFiller: addFillerProducts,
    setPrices,
  },
  supabaseIds,
);

const ANA_ID = "a0000000-0000-4000-8000-000000000002";
const ADMIN_ID = "a0000000-0000-4000-8000-000000000001";
const CREDENTIALS = {
  [ANA_ID]: { email: "ana@teste.dev", password: "Senha@123" },
  [ADMIN_ID]: { email: "admin@pixelperfect.local", password: "Admin@12345" },
};

describeEngagementContract(
  {
    name: "supabase",
    reset: resetDb,
    users: [ANA_ID, ADMIN_ID],
    forUser: (userId) => {
      const { email, password } = CREDENTIALS[userId as keyof typeof CREDENTIALS];
      let client: ReturnType<typeof signedInClient> | undefined;
      return createSupabaseEngagement({
        getClient: () => (client ??= signedInClient(email, password)),
      });
    },
    alertCount: async (email, productId) => {
      const { data, error } = await serviceClient()
        .from("stock_alerts")
        .select("id")
        .eq("email", email)
        .eq("product_id", productId);
      if (error) throw new Error(error.message);
      return data.length;
    },
  },
  supabaseIds,
);

describe("supabase account reads", () => {
  const reads = () =>
    createSupabaseAccountReads({ getClient: () => signedInClient("ana@teste.dev", "Senha@123") });

  it("reads the signed-in user's profile, lists and connections", async () => {
    const account = reads();
    expect(await account.profile(ANA_ID)).toMatchObject({ id: ANA_ID, email: "ana@teste.dev" });
    expect(await account.connections(ANA_ID)).toEqual([]);
    expect(Array.isArray(await account.addresses(ANA_ID))).toBe(true);
    expect(Array.isArray(await account.consents(ANA_ID))).toBe(true);
  });

  it("refuses another user's id and does not offer writes yet", async () => {
    const account = reads();
    await expect(account.profile(ADMIN_ID)).rejects.toThrow("session mismatch");
    await expect(account.deleteAddress(ANA_ID, "x")).rejects.toBeInstanceOf(NotAvailableYetError);
  });
});

describeNewsletterContract({
  name: "supabase",
  make: () =>
    createSupabaseNewsletter({ getClient: () => Promise.resolve(createSupabasePublicClient()) }),
  reset: resetDb,
});

describeRateLimitContract({
  name: "supabase",
  make: () => createSupabaseRateLimit({ getAdmin: serviceClient }),
  reset: resetDb,
});

/** The Supabase auth port bound to its own fresh cookie jar (one browser). */
function authInJar(
  jar = cookieJar(),
  overrides: Partial<Parameters<typeof createSupabaseAuth>[0]> = {},
) {
  const auth = createSupabaseAuth({
    getClient: () => Promise.resolve(jarClient(jar, "publishable")),
    getAuthClient: () => Promise.resolve(jarClient(jar, "secret")),
    getAdminClient: serviceClient,
    siteUrl: "http://localhost:3000",
    cookies: () => Promise.resolve(jar),
    ...overrides,
  });
  return { auth, jar };
}

const resetAuthEnv = async () => {
  await resetAuth();
  await clearInbox();
};

describeAuthContract({
  name: "supabase",
  reset: resetAuthEnv,
  readInbox,
  withSession: (fn) => fn(authInJar().auth),
  revokesOtherSessions: true,
  flagAsResignedUp: async (userId) => {
    const { error } = await serviceClient().auth.admin.updateUserById(userId, {
      app_metadata: { resignup: true },
    });
    if (error) throw new Error(error.message);
  },
  emailCooldownMs: 1100,
  signUpData: async (userId) => {
    const admin = serviceClient();
    const profile = await admin
      .from("profiles")
      .select("name, phone, cpf")
      .eq("id", userId)
      .single();
    const addresses = await admin.from("addresses").select("street").eq("user_id", userId);
    const consents = await admin.from("consents").select("type, version").eq("user_id", userId);
    if (profile.error) throw new Error(profile.error.message);
    if (addresses.error) throw new Error(addresses.error.message);
    if (consents.error) throw new Error(consents.error.message);
    return {
      name: profile.data.name,
      phone: profile.data.phone,
      cpf: profile.data.cpf,
      streets: addresses.data.map((a) => a.street),
      consents: consents.data.map((c) => `${c.type}:${c.version}`).toSorted(),
    };
  },
});

describe("supabase auth adapter", () => {
  const ANA = { email: "ana@teste.dev", password: "Senha@123" };
  const authCookie = (jar: ReturnType<typeof cookieJar>) =>
    [...jar.jar].find(([name]) => name.startsWith("sb-") && name.includes("-auth-token"));

  afterEach(async () => {
    vi.useRealTimers();
    await resetAuthEnv();
  });

  it("'manter conectado' keeps the session cookies for 30 days", async () => {
    const { auth, jar } = authInJar();
    await auth.signIn(ANA.email, ANA.password, true);
    expect(jar.jar.has(REMEMBER_COOKIE)).toBe(true);
    expect(authCookie(jar)?.[1].options.maxAge).toBe(REMEMBER_MAX_AGE);

    await auth.signOut();
    expect(jar.jar.has(REMEMBER_COOKIE)).toBe(false);
    expect(authCookie(jar)).toBeUndefined();
  });

  it("without 'manter conectado' the session cookies end with the browser", async () => {
    const { auth, jar } = authInJar();
    jar.set(REMEMBER_COOKIE, "1", { maxAge: REMEMBER_MAX_AGE }); // left by an earlier sign-in
    await auth.signIn(ANA.email, ANA.password, false);
    expect(jar.jar.has(REMEMBER_COOKIE)).toBe(false);
    const cookie = authCookie(jar)?.[1];
    expect(cookie).toBeDefined();
    expect(cookie?.options.maxAge).toBeUndefined();
    expect(cookie?.options.expires).toBeUndefined();
  });

  it("renews an expired access token with the refresh token", async () => {
    const { auth, jar } = authInJar();
    const user = await auth.signIn(ANA.email, ANA.password, false);
    const before = authCookie(jar)?.[1].value;
    // Only Date is faked: fetch and timers keep working. jwt_expiry is 3600 s.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
    expect(await auth.currentUser()).toEqual(user);
    expect(authCookie(jar)?.[1].value).not.toBe(before);
  });

  it("a later sign-up for a pending e-mail keeps its CPF and address, not its password", async () => {
    const email = `pendente-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
    const base = {
      email,
      phone: "(11) 91234-5678",
      acceptTerms: true as const,
      marketingEmail: true,
      termsVersion: "2026-10-28",
    };
    const first = await authInJar().auth.signUp(
      {
        ...base,
        name: "Quem Chegou Antes",
        password: "Primeira@123",
        cpf: "123.456.789-09",
        address: {
          cep: "01310-100",
          street: "Av. Paulista",
          number: "1000",
          district: "Bela Vista",
          city: "São Paulo",
          state: "SP",
        },
      },
      "/conta",
    );
    // Past GoTrue's e-mail frequency window (1 s locally), so this sign-up sends a new e-mail.
    await new Promise((r) => setTimeout(r, 1100));
    const again = await authInJar().auth.signUp(
      { ...base, name: "Dona do E-mail", password: "Segunda@123", marketingEmail: false },
      "/conta",
    );
    expect(again.userId).toBe(first.userId);
    expect(await readInbox(email)).toHaveLength(2);

    const admin = serviceClient();
    const id = first.userId as string;
    const profile = await admin.from("profiles").select("name, cpf").eq("id", id).single();
    expect(profile.data).toEqual({ name: "Dona do E-mail", cpf: "12345678909" });
    const consents = await admin.from("consents").select("type").eq("user_id", id).order("type");
    // Same terms version both times: nothing new to append, nothing deleted (marketing stays).
    expect(consents.data?.map((c) => c.type)).toEqual(["email_marketing", "privacy", "terms"]);
    const addresses = await admin.from("addresses").select("street").eq("user_id", id);
    expect(addresses.data).toEqual([{ street: "Av. Paulista" }]);

    await expectScrambledOnConfirm(email, id, await latestLink(email));
  });

  it("the 429 path (no new e-mail) still keeps nobody's password, even with the original link", async () => {
    const email = `pendente-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
    const base = {
      email,
      phone: "(11) 91234-5678",
      acceptTerms: true as const,
      marketingEmail: false,
      termsVersion: "2026-10-28",
    };
    const first = await authInJar().auth.signUp(
      { ...base, name: "Quem Chegou Antes", password: "Primeira@123" },
      "/conta",
    );
    // Within GoTrue's e-mail frequency window: over_email_send_rate_limit, no new e-mail.
    const again = await authInJar().auth.signUp(
      { ...base, name: "Dona do E-mail", password: "Segunda@123" },
      "/conta",
    );
    expect(again).toEqual({ status: "confirmacao_pendente", userId: first.userId });
    const inbox = await readInbox(email);
    expect(inbox).toHaveLength(1);
    await expectScrambledOnConfirm(email, first.userId as string, inbox[0].link);
  });

  /** Confirming a re-signed-up account: neither password works until the user sets one. */
  async function expectScrambledOnConfirm(email: string, id: string, link: string) {
    const token = new URL(link, "http://x.invalid").searchParams.get("token_hash") as string;
    const { auth } = authInJar();
    expect(await auth.verifyEmailLink(token, "email")).toEqual({ ok: true, mustSetPassword: true });
    expect(await auth.currentUser()).toMatchObject({ id, name: "Dona do E-mail" });
    // The scrambled account sets its password on /redefinir-senha: still an e-mail-link session.
    expect(await auth.linkSessionAllowsPasswordReset()).toBe(true);
    const stored = await serviceClient().auth.admin.getUserById(id);
    expect(stored.data.user?.app_metadata.resignup).toBeUndefined();

    const other = authInJar().auth;
    expect(await other.signIn(email, "Primeira@123", false)).toBeNull();
    expect(await other.signIn(email, "Segunda@123", false)).toBeNull();
    expect(await auth.updatePassword("Terceira@123")).toEqual({ ok: true });
    expect(await authInJar().auth.signIn(email, "Terceira@123", false)).toMatchObject({ id });
  }

  describe("GoTrue per-IP limit (429) on links and OAuth codes", () => {
    const tooMany = () => ({
      data: { user: null, session: null },
      error: new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
    });

    it("verifyOtp goes through the IP-forwarding client; a 429 is retryable and keeps the link", async () => {
      const email = `limite-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
      await authInJar().auth.signUp(
        {
          name: "Pessoa Limite",
          email,
          phone: "(11) 91234-5678",
          password: "Senha@123",
          acceptTerms: true,
          marketingEmail: false,
          termsVersion: "2026-10-28",
        },
        "/conta",
      );
      const token = new URL(await latestLink(email), "http://x.invalid").searchParams.get(
        "token_hash",
      ) as string;
      const jar = cookieJar();
      const { auth } = authInJar(jar, {
        getAuthClient: () => {
          const client = jarClient(jar, "secret");
          client.auth.verifyOtp = () => Promise.resolve(tooMany());
          return Promise.resolve(client);
        },
      });
      expect(await auth.verifyEmailLink(token, "email")).toEqual({ ok: false, retry: true });
      expect(await auth.currentUser()).toBeNull();
      // Not consumed: the real verification still works.
      expect(await authInJar().auth.verifyEmailLink(token, "email")).toEqual({
        ok: true,
        mustSetPassword: false,
      });
    });

    it("exchangeCodeForSession goes through the IP-forwarding client; a 429 is retryable", async () => {
      const jar = cookieJar();
      let called = false;
      const { auth } = authInJar(jar, {
        getAuthClient: () => {
          const client = jarClient(jar, "secret");
          client.auth.exchangeCodeForSession = () => {
            called = true;
            return Promise.resolve(tooMany());
          };
          return Promise.resolve(client);
        },
      });
      expect(await auth.completeOAuth("any-code")).toEqual({ ok: false, retry: true });
      expect(called).toBe(true);
    });

    it("an unknown OAuth code is a plain failure", async () => {
      expect(await authInJar().auth.completeOAuth("not-a-real-code")).toEqual({ ok: false });
    });
  });

  it("saves and reads back the signed-in user's cart", async () => {
    const { auth } = authInJar();
    const user = await auth.signIn(ANA.email, ANA.password, false);
    if (!user || "error" in user) throw new Error("sign-in failed");
    expect(await auth.savedCart(user.id)).toBeNull();
    const cart: CartData = { lines: [{ productId: "p1", qty: 2, ring: "mosquetao" }] };
    await auth.saveCart(user.id, cart);
    expect(await auth.savedCart(user.id)).toEqual(cart);
  });

  it("returns a sign-in URL for an OAuth provider", async () => {
    const { auth } = authInJar();
    const { url } = await auth.signInWithProvider("google", "/conta");
    expect(new URL(url).pathname).toBe("/auth/v1/authorize");
    expect(new URL(url).searchParams.get("redirect_to")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fconta",
    );
  });

  describe("confirming a re-signed-up account fails closed", () => {
    const failure = () => ({
      data: { user: null },
      error: new AuthApiError("simulated failure", 500, "unexpected_failure"),
    });

    /** P1 signs up, P2 signs up again (flagged); returns the confirmation token. */
    async function flaggedAccount(email: string) {
      const base = {
        email,
        phone: "(11) 91234-5678",
        acceptTerms: true as const,
        marketingEmail: false,
        termsVersion: "2026-10-28",
      };
      const first = await authInJar().auth.signUp(
        { ...base, name: "Quem Chegou Antes", password: "Primeira@123" },
        "/conta",
      );
      await authInJar().auth.signUp(
        { ...base, name: "Dona do E-mail", password: "Segunda@123" },
        "/conta",
      );
      const link = (await readInbox(email))[0].link;
      const token = new URL(link, "http://x.invalid").searchParams.get("token_hash") as string;
      return { id: first.userId as string, token };
    }

    /** Publishable client over `jar` whose updateUser fails once (the in-session scramble). */
    function clientFailingUpdateOnce(jar: ReturnType<typeof cookieJar>) {
      let failed = false;
      return () => {
        const client = jarClient(jar, "publishable");
        const real = client.auth.updateUser.bind(client.auth);
        client.auth.updateUser = (...args: Parameters<typeof real>) => {
          if (failed) return real(...args);
          failed = true;
          return Promise.resolve(failure());
        };
        return Promise.resolve(client);
      };
    }

    const oldPasswordsFail = async (email: string) => {
      const other = authInJar().auth;
      expect(await other.signIn(email, "Primeira@123", false)).toBeNull();
      expect(await other.signIn(email, "Segunda@123", false)).toBeNull();
    };

    it("falls back to the admin API and reopens the session", async () => {
      const email = `pendente-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
      const { id, token } = await flaggedAccount(email);
      const jar = cookieJar();
      const { auth } = authInJar(jar, { getClient: clientFailingUpdateOnce(jar) });

      expect(await auth.verifyEmailLink(token, "email")).toEqual({
        ok: true,
        mustSetPassword: true,
      });
      expect(await auth.currentUser()).toMatchObject({ id });
      // Reopened with an admin-generated magic link: still allowed on /redefinir-senha.
      expect(await auth.linkSessionAllowsPasswordReset()).toBe(true);
      await oldPasswordsFail(email);
      const stored = await serviceClient().auth.admin.getUserById(id);
      expect(stored.data.user?.app_metadata.resignup).toBeUndefined();
      expect(await auth.updatePassword("Terceira@123")).toEqual({ ok: true });
      expect(await authInJar().auth.signIn(email, "Terceira@123", false)).toMatchObject({ id });
    });

    it("when both ways fail: not ok, signed out, flag kept", async () => {
      const email = `pendente-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
      const { id, token } = await flaggedAccount(email);
      const jar = cookieJar();
      const admin = serviceClient();
      const realAdminUpdate = admin.auth.admin.updateUserById.bind(admin.auth.admin);
      admin.auth.admin.updateUserById = (uid, attrs) =>
        attrs.password ? Promise.resolve(failure()) : realAdminUpdate(uid, attrs);
      const { auth } = authInJar(jar, {
        getClient: clientFailingUpdateOnce(jar),
        getAdminClient: () => admin,
      });

      expect(await auth.verifyEmailLink(token, "email")).toEqual({ ok: false });
      expect(await auth.currentUser()).toBeNull();
      expect([...jar.jar.keys()].some((n) => n.includes("-auth-token"))).toBe(false);
      const stored = await serviceClient().auth.admin.getUserById(id);
      expect(stored.data.user?.app_metadata.resignup).toBe(true);
      // Confirmed with the flag still set: the first comer's password opens nothing, and the
      // owner's recovery link scrambles it (see the contract).
      await oldPasswordsFail(email);
    });
  });
});
