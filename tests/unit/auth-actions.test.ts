import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, cookies } = vi.hoisted(() => {
  const jar = new Map<string, string>();
  return {
    getSession: vi.fn(),
    cookies: {
      jar,
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string, options: { maxAge?: number }) => {
        if (value === "" || options.maxAge === 0) jar.delete(name);
        else jar.set(name, value);
      },
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession }));
// The mock adapter keeps its session in these cookies.
// No proxy header in these requests: the rate limit only counts the e-mail key.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookies),
  headers: () => Promise.resolve(new Headers()),
}));

import {
  loginAction,
  logoutAction,
  saveCartAction,
  recoverAction,
  resendConfirmationAction,
  signupAction,
  socialAction,
  syncCartAction,
} from "@/app/(conta)/actions";
import { getData } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock/store";

const ana = { id: "ana", name: "Ana Souza", email: "ana@teste.dev" };
const login = (over: object = {}) => ({
  email: "ana@teste.dev",
  password: "Senha@123",
  remember: false,
  ...over,
});
const signup = (over: object = {}) => ({
  name: "Nova Pessoa",
  email: "nova@teste.dev",
  phone: "(11) 91234-5678",
  password: "Senha@123",
  confirmPassword: "Senha@123",
  acceptTerms: true,
  marketingEmail: false,
  ...over,
});

beforeEach(() => {
  getMockStore().reset();
  cookies.jar.clear();
  getSession.mockReset();
  getSession.mockResolvedValue(null);
});

describe("loginAction", () => {
  it("creates the session and returns the safe redirect", async () => {
    const r = await loginAction(login({ remember: true, next: "/loja?x=1" }));
    expect(r).toEqual({ status: "ok", redirectTo: "/loja?x=1" });
    expect(cookies.jar.has("pp_session")).toBe(true);
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", undefined])(
    "ignores the unsafe next %j and goes to /conta",
    async (next) => {
      expect(await loginAction(login({ next }))).toEqual({ status: "ok", redirectTo: "/conta" });
    },
  );

  it("gives the same generic error for a wrong password, unknown e-mail and invalid input", async () => {
    const wrong = await loginAction(login({ password: "errada" }));
    const unknown = await loginAction(login({ email: "ninguem@teste.dev" }));
    const invalid = await loginAction({ email: "x", password: "" });
    expect(wrong).toEqual({ status: "error", message: "E-mail ou senha incorretos." });
    expect(unknown).toEqual(wrong);
    expect(invalid).toEqual(wrong);
    expect(cookies.jar.size).toBe(0);
  });

  it("tells an account not confirmed yet to confirm the e-mail (right password only)", async () => {
    await signupAction(signup());
    expect(await loginAction(login({ email: "nova@teste.dev" }))).toEqual({
      status: "error",
      message: "Confirme seu e-mail para entrar.",
      unconfirmed: true,
    });
    expect(await loginAction(login({ email: "nova@teste.dev", password: "Errada@123" }))).toEqual({
      status: "error",
      message: "E-mail ou senha incorretos.",
    });
    expect(cookies.jar.size).toBe(0);
  });

  it("refuses the 6th attempt with the same e-mail in 15 min without calling signIn", async () => {
    for (let i = 0; i < 5; i++) await loginAction(login({ password: "Errada@123" }));
    const signIn = vi.spyOn(getData().auth, "signIn");
    try {
      expect(await loginAction(login())).toEqual({
        status: "error",
        message: "Muitas tentativas. Tente de novo em alguns minutos.",
      });
      expect(signIn).not.toHaveBeenCalled();
    } finally {
      signIn.mockRestore();
    }
    expect(cookies.jar.has("pp_session")).toBe(false);
  });
});

describe("signupAction", () => {
  it("creates the account pending confirmation, with the consents and no session", async () => {
    const r = await signupAction(signup({ marketingEmail: true }));
    expect(r).toEqual({
      status: "ok",
      redirectTo: "/cadastro/confirme-seu-email?email=nova%40teste.dev",
    });
    expect(cookies.jar.size).toBe(0);
    expect(getMockStore().inbox.map((m) => m.kind)).toEqual(["confirmacao"]);
    expect(getMockStore().consents.map((c) => [c.type, c.version])).toEqual([
      ["terms", "2026-10-28"],
      ["privacy", "2026-10-28"],
      ["email_marketing", "2026-10-28"],
    ]);
  });

  it("answers an e-mail already in use exactly like a new one", async () => {
    const r = await signupAction(signup({ email: "ana@teste.dev" }));
    expect(r).toEqual({
      status: "ok",
      redirectTo: "/cadastro/confirme-seu-email?email=ana%40teste.dev",
    });
    expect(cookies.jar.size).toBe(0);
  });

  it("puts the confirmation link's next in the e-mail and keeps it for the resend", async () => {
    const r = await signupAction(signup({ next: "/checkout" }));
    expect(r.redirectTo).toBe(
      "/cadastro/confirme-seu-email?email=nova%40teste.dev&next=%2Fcheckout",
    );
    expect(getMockStore().inbox[0]?.link).toContain("next=%2Fcheckout");
  });

  it("refuses the 6th sign-up with the same e-mail without creating anything", async () => {
    for (let i = 0; i < 5; i++) await signupAction(signup());
    expect(await signupAction(signup())).toEqual({
      status: "error",
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    });
    expect(getMockStore().inbox).toHaveLength(5);
  });

  it("revalidates on the server: weak password and unaccepted terms", async () => {
    const weak = await signupAction(signup({ password: "abc" }));
    expect(weak.status).toBe("error");
    expect(weak.fieldErrors).toHaveProperty("password");
    const mismatch = await signupAction(signup({ confirmPassword: "Outra@1234" }));
    expect(mismatch.fieldErrors).toEqual({ confirmPassword: "As senhas não conferem." });
    const terms = await signupAction(signup({ acceptTerms: false }));
    expect(terms.fieldErrors).toHaveProperty("acceptTerms");
    expect(getMockStore().pendingUsers).toEqual([]);
  });
});

describe("recoverAction", () => {
  it("answers identically for a known and an unknown e-mail", async () => {
    const known = await recoverAction({ email: "ana@teste.dev" });
    const unknown = await recoverAction({ email: "ninguem@teste.dev" });
    expect(known.status).toBe("ok");
    expect(unknown).toEqual(known);
  });

  it("rejects a malformed e-mail", async () => {
    expect((await recoverAction({ email: "x" })).status).toBe("error");
  });

  it("is rate limited per e-mail", async () => {
    for (let i = 0; i < 5; i++) await recoverAction({ email: "ana@teste.dev" });
    expect(await recoverAction({ email: "ana@teste.dev" })).toEqual({
      status: "error",
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    });
    expect(getMockStore().inbox).toHaveLength(5);
  });
});

describe("resendConfirmationAction", () => {
  const SENT = "Se houver uma conta pendente, enviamos um novo link.";

  it("sends a new link to a pending account, carrying the safe next", async () => {
    await signupAction(signup());
    const r = await resendConfirmationAction("nova@teste.dev", "/checkout");
    expect(r).toEqual({ status: "ok", message: SENT });
    const links = getMockStore().inbox.map((m) => m.link);
    expect(links).toHaveLength(2);
    expect(links[1]).toContain("next=%2Fcheckout");
  });

  it("answers the same for confirmed, unknown and malformed e-mails, sending nothing", async () => {
    for (const email of ["ana@teste.dev", "ninguem@teste.dev", "x", 42]) {
      expect(await resendConfirmationAction(email, "//evil.com")).toEqual({
        status: "ok",
        message: SENT,
      });
    }
    expect(getMockStore().inbox).toEqual([]);
  });

  it("refuses the 6th resend for the same e-mail", async () => {
    await signupAction(signup());
    for (let i = 0; i < 5; i++) await resendConfirmationAction("nova@teste.dev", "/conta");
    expect(await resendConfirmationAction("nova@teste.dev", "/conta")).toEqual({
      status: "error",
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    });
    expect(getMockStore().inbox).toHaveLength(6);
  });
});

describe("socialAction", () => {
  it("returns the provider URL, carrying the safe next", async () => {
    expect(await socialAction("google", "/loja")).toEqual({
      status: "ok",
      redirectTo: "/auth/callback?code=mock-google&next=%2Floja",
    });
    expect(await socialAction("facebook", "//evil.com")).toEqual({
      status: "ok",
      redirectTo: "/auth/callback?code=mock-facebook&next=%2Fconta",
    });
  });

  it("refuses unknown providers and Apple while it is disabled", async () => {
    expect((await socialAction("github", undefined)).status).toBe("error");
    expect((await socialAction("apple", undefined)).status).toBe("error");
  });
});

describe("syncCartAction", () => {
  it("needs a session", async () => {
    expect(await syncCartAction([], null)).toBeNull();
  });

  it("merges the local cart with the saved one, drops unknown products and saves", async () => {
    getSession.mockResolvedValue(ana);
    const merged = await syncCartAction(
      [
        { productId: "garota", ring: "mosquetao", qty: 1 },
        { productId: "e13", ring: "mosquetao", qty: 2 },
        { productId: "nao-existe", ring: "estrela", qty: 1 },
        { bad: true },
      ],
      null,
    );
    const lines = [
      { productId: "e13", ring: "mosquetao", qty: 3 },
      { productId: "garota", ring: "mosquetao", qty: 1 },
    ];
    expect(merged).toEqual({ lines, owner: "ana" });
    expect(getMockStore().savedCarts.ana).toEqual({ lines });
  });

  it("keeps the local lines (edits made while signed in) when the same user logs in again", async () => {
    getSession.mockResolvedValue(ana);
    const lines = [
      { productId: "e13", ring: "mosquetao", qty: 1 },
      { productId: "garota", ring: "estrela", qty: 2 },
    ];
    const again = await syncCartAction(lines, "ana");
    expect(again).toEqual({ lines, owner: "ana" });
    expect(getMockStore().savedCarts.ana).toEqual({ lines });
  });
});

describe("saveCartAction", () => {
  it("is a no-op without a session", async () => {
    await saveCartAction([{ productId: "e13", ring: "mosquetao", qty: 5 }]);
    expect(getMockStore().savedCarts.ana).toEqual({
      lines: [{ productId: "e13", ring: "mosquetao", qty: 1 }],
    });
  });

  it("saves under the session user, sanitized, and drops unknown products", async () => {
    getSession.mockResolvedValue(ana);
    await saveCartAction([
      { productId: "e13", ring: "mosquetao", qty: 500 },
      { productId: "nao-existe", ring: "estrela", qty: 1 },
      { bad: true },
    ]);
    expect(getMockStore().savedCarts.ana).toEqual({
      lines: [{ productId: "e13", ring: "mosquetao", qty: 99 }],
    });
    expect(Object.keys(getMockStore().savedCarts)).toEqual(["ana"]);
  });
});

describe("logoutAction", () => {
  it("ends the session and forgets the guest order tokens", async () => {
    await loginAction(login());
    cookies.jar.set("pp_guest_orders", JSON.stringify(["t1"]));
    expect(cookies.jar.has("pp_session")).toBe(true);
    await logoutAction();
    expect(cookies.jar.has("pp_session")).toBe(false);
    expect(cookies.jar.has("pp_guest_orders")).toBe(false);
  });
});

describe("cart line cap", () => {
  const many = Array.from({ length: 51 }, () => ({
    productId: "garota",
    ring: "mosquetao",
    qty: 1,
  }));

  it("syncCartAction ignores a local cart with more than 50 lines", async () => {
    getSession.mockResolvedValue(ana);
    const result = await syncCartAction(many, null);
    expect(result?.lines.find((l) => l.productId === "garota")).toBeUndefined();
  });

  it("saveCartAction does not save a cart with more than 50 lines", async () => {
    getSession.mockResolvedValue(ana);
    const before = getMockStore().savedCarts.ana;
    await saveCartAction(many);
    expect(getMockStore().savedCarts.ana).toEqual(before);
  });
});
