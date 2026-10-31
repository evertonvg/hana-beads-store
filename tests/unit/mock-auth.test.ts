import { beforeEach, describe, expect, it } from "vitest";
import { createMockAuth } from "@/lib/data/mock/auth";
import { getMockStore } from "@/lib/data/mock/store";
import { MARKETING_CONSENT_VERSION } from "@/lib/validation/account";

const newUser = {
  name: "Nova Pessoa",
  email: "Nova@Teste.dev",
  phone: "(11) 91234-5678",
  password: "Senha@123",
  acceptTerms: true as const,
  marketingEmail: false,
  termsVersion: "2026-10-28",
};

describe("mock auth", () => {
  beforeEach(() => getMockStore().reset());

  it("signs in the fixture users and rejects wrong credentials", async () => {
    const port = createMockAuth();
    expect(await port.signIn("ANA@teste.dev", "Senha@123")).toEqual({
      id: "ana",
      name: "Ana Souza",
      email: "ana@teste.dev",
    });
    expect(await port.signIn("ana@teste.dev", "errada")).toBeNull();
    expect(await port.signIn("ninguem@teste.dev", "Senha@123")).toBeNull();
  });

  it("signs up, normalizes the e-mail and then signs in", async () => {
    const port = createMockAuth();
    const user = await port.signUp(newUser);
    expect(user).toMatchObject({ name: "Nova Pessoa", email: "nova@teste.dev" });
    expect(await port.signIn("nova@teste.dev", "Senha@123")).toEqual(user);
  });

  it("refuses an e-mail already in use", async () => {
    const port = createMockAuth();
    expect(await port.signUp({ ...newUser, email: "ana@teste.dev" })).toEqual({
      error: "email_em_uso",
    });
  });

  it("records terms and privacy consent, plus marketing only when checked", async () => {
    const port = createMockAuth();
    const a = (await port.signUp(newUser)) as { id: string };
    const b = (await port.signUp({ ...newUser, email: "b@teste.dev", marketingEmail: true })) as {
      id: string;
    };
    const types = (id: string) =>
      getMockStore()
        .consents.filter((c) => c.userId === id)
        .map((c) => [c.type, c.version]);
    expect(types(a.id)).toEqual([
      ["terms", "2026-10-28"],
      ["privacy", "2026-10-28"],
    ]);
    expect(types(b.id)).toEqual([
      ["terms", "2026-10-28"],
      ["privacy", "2026-10-28"],
      ["email_marketing", "2026-10-28"],
    ]);
  });

  it("logs a provider sign-in as ana and finds users by id", async () => {
    const port = createMockAuth();
    expect((await port.signInWithProvider("google")).id).toBe("ana");
    expect(await port.userById("bruno")).toMatchObject({ email: "bruno@teste.dev" });
    expect(await port.userById("nope")).toBeNull();
  });

  it("keeps ana's saved cart in the fixtures and saves per user", async () => {
    const port = createMockAuth();
    expect(await port.savedCart("ana")).toEqual({
      lines: [{ productId: "e13", ring: "mosquetao", qty: 1 }],
    });
    expect(await port.savedCart("bruno")).toBeNull();
    await port.saveCart("bruno", { lines: [{ productId: "garota", ring: "estrela", qty: 2 }] });
    expect(await port.savedCart("bruno")).toEqual({
      lines: [{ productId: "garota", ring: "estrela", qty: 2 }],
    });
  });

  it("resolves the same for known and unknown e-mails when requesting a reset", async () => {
    const port = createMockAuth();
    await expect(port.requestPasswordReset("ana@teste.dev")).resolves.toBeUndefined();
    await expect(port.requestPasswordReset("ninguem@teste.dev")).resolves.toBeUndefined();
  });

  it("never reuses the id of a deleted user", async () => {
    const port = createMockAuth();
    const first = await port.signUp(newUser);
    if ("error" in first) throw new Error("unexpected");
    const store = getMockStore();
    store.users = store.users.filter((u) => u.id !== first.id);
    const second = await port.signUp({ ...newUser, email: "outra@teste.dev" });
    if ("error" in second) throw new Error("unexpected");
    expect(second.id).not.toBe(first.id);
    expect(await port.userById(first.id)).toBeNull();
  });

  it("records the marketing consent with the marketing text version", async () => {
    const port = createMockAuth();
    await port.signUp({ ...newUser, marketingEmail: true, termsVersion: "2020-01-01" });
    const marketing = getMockStore().consents.find((c) => c.type === "email_marketing");
    expect(marketing?.version).toBe(MARKETING_CONSENT_VERSION);
    const terms = getMockStore().consents.find((c) => c.type === "terms");
    expect(terms?.version).toBe("2020-01-01");
  });
});
