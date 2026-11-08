import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies } = vi.hoisted(() => {
  const jar = new Map<string, string>();
  return {
    cookies: {
      jar,
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string, options: { maxAge?: number } = {}) => {
        if (value === "" || options.maxAge === 0) jar.delete(name);
        else jar.set(name, value);
      },
    },
  };
});

vi.mock("server-only", () => ({}));
// The mock adapter keeps its session in these cookies; the routes also set the sync marker here.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookies),
  headers: () => Promise.resolve(new Headers()),
}));

import { GET as callback } from "@/app/auth/callback/route";
import { GET as confirm } from "@/app/auth/confirm/route";
import { FINISH_AUTH_COOKIE } from "@/lib/auth/finish-auth-marker";
import { getData } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock/store";

const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

/** Status and the redirect target as path + query. */
async function follow(response: Promise<Response> | Response) {
  const r = await response;
  const location = r.headers.get("location");
  const url = location ? new URL(location) : null;
  return { status: r.status, to: url ? `${url.pathname}${url.search}` : null };
}

/** Token of the last link the mock "e-mailed". */
function lastToken(): string {
  const link = getMockStore().inbox.at(-1)?.link ?? "";
  return new URL(link, "http://x.invalid").searchParams.get("token_hash") ?? "";
}

async function signUpNova(next = "/conta") {
  await getData().auth.signUp(
    {
      name: "Nova Pessoa",
      email: "nova@teste.dev",
      phone: "11912345678",
      password: "Senha@123",
      marketingEmail: false,
      acceptTerms: true,
      termsVersion: "v1",
    },
    next,
  );
  return lastToken();
}

const signedIn = () => cookies.jar.has("pp_session");
const marked = () => cookies.get(FINISH_AUTH_COOKIE)?.value === "1";

beforeEach(() => {
  getMockStore().reset();
  cookies.jar.clear();
});

describe("GET /auth/confirm", () => {
  it("an invalid token_hash goes to /entrar?erro=link with 303 and no session", async () => {
    expect(await follow(confirm(request("/auth/confirm?token_hash=nope&type=email")))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
    expect(signedIn()).toBe(false);
    expect(marked()).toBe(false);
  });

  it("a missing token_hash goes to /entrar?erro=link", async () => {
    expect(await follow(confirm(request("/auth/confirm?type=email")))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
  });

  it.each(["signup", "magiclink", "", "EMAIL"])(
    "type=%j (not accepted) goes to /entrar?erro=link without using the token",
    async (type) => {
      const token = await signUpNova();
      expect(
        await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=${type}`))),
      ).toEqual({ status: 303, to: "/entrar?erro=link" });
      expect(signedIn()).toBe(false);
      // Still valid: the rejected request did not consume it.
      expect(getMockStore().emailTokens[token]).toBeDefined();
    },
  );

  it("a valid e-mail link signs in, marks the cart sync and follows next", async () => {
    const token = await signUpNova();
    const next = encodeURIComponent("/loja?x=1");
    expect(
      await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=email&next=${next}`))),
    ).toEqual({ status: 303, to: "/loja?x=1" });
    expect(signedIn()).toBe(true);
    expect(marked()).toBe(true);
  });

  it.each(["//evil.com", "https://evil.com", "%2F%2Fevil.com", "/\\evil.com"])(
    "next=%s is ignored and goes to /conta",
    async (evil) => {
      const token = await signUpNova();
      const r = await follow(
        confirm(
          request(`/auth/confirm?token_hash=${token}&type=email&next=${encodeURIComponent(evil)}`),
        ),
      );
      expect(r).toEqual({ status: 303, to: "/conta" });
    },
  );

  it("without next goes to /conta", async () => {
    const token = await signUpNova();
    expect(await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=email`)))).toEqual({
      status: 303,
      to: "/conta",
    });
  });

  it("a link opened twice fails the second time", async () => {
    const token = await signUpNova();
    await confirm(request(`/auth/confirm?token_hash=${token}&type=email`));
    cookies.jar.clear();
    expect(await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=email`)))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
  });

  it("a valid recovery link goes to /redefinir-senha with a session (next is ignored)", async () => {
    await getData().auth.requestPasswordReset("ana@teste.dev");
    const token = lastToken();
    expect(
      await follow(
        confirm(request(`/auth/confirm?token_hash=${token}&type=recovery&next=%2Floja`)),
      ),
    ).toEqual({ status: 303, to: "/redefinir-senha" });
    expect(signedIn()).toBe(true);
    expect(marked()).toBe(true);
  });

  it("a recovery token used as type=email fails", async () => {
    await getData().auth.requestPasswordReset("ana@teste.dev");
    const token = lastToken();
    expect(await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=email`)))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
  });

  it("a re-signed-up account must choose a password: /redefinir-senha, not next", async () => {
    await signUpNova("/loja");
    const token = await signUpNova("/loja");
    expect(
      await follow(confirm(request(`/auth/confirm?token_hash=${token}&type=email&next=%2Floja`))),
    ).toEqual({ status: 303, to: "/redefinir-senha" });
    expect(signedIn()).toBe(true);
  });
});

describe("GET /auth/callback", () => {
  it("a valid code signs in as Ana, marks the cart sync and follows next", async () => {
    expect(await follow(callback(request("/auth/callback?code=mock-google&next=%2Floja")))).toEqual(
      { status: 303, to: "/loja" },
    );
    expect(signedIn()).toBe(true);
    expect(marked()).toBe(true);
  });

  it.each(["//evil.com", "https://evil.com", "%2F%2Fevil.com"])(
    "next=%s is ignored and goes to /conta",
    async (evil) => {
      expect(
        await follow(
          callback(request(`/auth/callback?code=mock-google&next=${encodeURIComponent(evil)}`)),
        ),
      ).toEqual({ status: 303, to: "/conta" });
    },
  );

  it("an invalid code goes to /entrar?erro=link without a session", async () => {
    expect(await follow(callback(request("/auth/callback?code=bad")))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
    expect(signedIn()).toBe(false);
    expect(marked()).toBe(false);
  });

  it("no code (provider error or cancel) goes to /entrar?erro=link", async () => {
    expect(await follow(callback(request("/auth/callback?error=access_denied")))).toEqual({
      status: 303,
      to: "/entrar?erro=link",
    });
  });
});
