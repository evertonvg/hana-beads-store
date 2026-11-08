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
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookies),
  headers: () => Promise.resolve(new Headers()),
}));
// getSession awaits `connection()`, which needs a Next request.
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

import { resetPasswordAction } from "@/app/(conta)/redefinir-senha/actions";
import { getData } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock/store";
import { resetPasswordSchema } from "@/lib/validation/reset-password";

const input = (over: object = {}) => ({
  password: "Nova@1234",
  confirmPassword: "Nova@1234",
  ...over,
});

const ana = () => getMockStore().users.find((u) => u.id === "ana");

/** Opens Ana's session through the recovery link, as /auth/confirm does. */
async function openRecoveryLink() {
  const { auth } = getData();
  await auth.requestPasswordReset("ana@teste.dev");
  const link = getMockStore().inbox.at(-1)?.link ?? "";
  const token = new URL(link, "http://x.invalid").searchParams.get("token_hash") ?? "";
  expect(await auth.verifyEmailLink(token, "recovery")).toMatchObject({ ok: true });
}

const REFUSED = "Não foi possível alterar a senha. Tente outra senha ou peça um novo link.";

beforeEach(() => {
  getMockStore().reset();
  cookies.jar.clear();
});

describe("resetPasswordSchema", () => {
  it("follows the sign-up password rules and needs a matching confirmation", () => {
    expect(resetPasswordSchema.safeParse(input()).success).toBe(true);
    const weak = resetPasswordSchema.safeParse(input({ password: "abcdefgh" }));
    expect(weak.success).toBe(false);
    expect(weak.error?.issues[0]?.message).toBe("A senha precisa cumprir todas as regras.");
    const mismatch = resetPasswordSchema.safeParse(input({ confirmPassword: "Outra@1234" }));
    expect(mismatch.error?.issues).toEqual([
      expect.objectContaining({ path: ["confirmPassword"], message: "As senhas não conferem." }),
    ]);
  });
});

describe("resetPasswordAction", () => {
  it("changes the password of a session the recovery link opened and sends to /conta", async () => {
    await openRecoveryLink();
    expect(await resetPasswordAction(input())).toEqual({
      status: "ok",
      message: "Senha alterada.",
      redirectTo: "/conta",
    });
    expect(ana()?.password).toBe("Nova@1234");
  });

  it("returns the field errors for an invalid input and changes nothing", async () => {
    await openRecoveryLink();
    const r = await resetPasswordAction(input({ password: "fraca", confirmPassword: "fraca" }));
    expect(r).toMatchObject({
      status: "error",
      message: "Confira os campos.",
      fieldErrors: { password: "A senha precisa cumprir todas as regras." },
    });
    expect(ana()?.password).toBe("Senha@123");
  });

  it("without a session asks for a new link", async () => {
    expect(await resetPasswordAction(input())).toEqual({
      status: "error",
      message: "Sua sessão expirou. Peça um novo link.",
    });
  });

  it("refuses a session opened with the password (it must give the current one in /conta)", async () => {
    await getData().auth.signIn("ana@teste.dev", "Senha@123", false);
    expect(await resetPasswordAction(input())).toEqual({ status: "error", message: REFUSED });
    expect(ana()?.password).toBe("Senha@123");
  });

  it("refuses a social sign-in session", async () => {
    await getData().auth.completeOAuth("mock-google");
    expect(await resetPasswordAction(input())).toEqual({ status: "error", message: REFUSED });
    expect(ana()?.password).toBe("Senha@123");
  });

  it("refuses a link session older than 15 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await openRecoveryLink();
      vi.setSystemTime(Date.now() + 16 * 60 * 1000);
      expect(await resetPasswordAction(input())).toEqual({ status: "error", message: REFUSED });
      expect(ana()?.password).toBe("Senha@123");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a refused update gives an error, not a redirect", async () => {
    await openRecoveryLink();
    const spy = vi.spyOn(getData().auth, "updatePassword").mockResolvedValueOnce({ ok: false });
    const r = await resetPasswordAction(input());
    expect(r.status).toBe("error");
    expect(r).not.toHaveProperty("redirectTo");
    spy.mockRestore();
  });

  it("an infrastructure failure gives the generic error", async () => {
    await openRecoveryLink();
    const spy = vi.spyOn(getData().auth, "updatePassword").mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    expect(await resetPasswordAction(input())).toEqual({
      status: "error",
      message: "Não foi possível agora. Tente de novo.",
    });
    spy.mockRestore();
  });
});
