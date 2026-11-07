import { beforeEach, describe, expect, it } from "vitest";
import { createMockAccount } from "@/lib/data/mock/account";
import { createMockEngagement } from "@/lib/data/mock/engagement";
import { createMockNewsletter } from "@/lib/data/mock/newsletter";
import { createMockOrders } from "@/lib/data/mock/orders";
import { createMockReturns } from "@/lib/data/mock/returns";
import { getMockStore } from "@/lib/data/mock/store";
import type { Address } from "@/lib/data/types";
import { mockAuthInJar } from "./memory-cookies";

const home: Address = {
  label: "Trabalho",
  cep: "01001-000",
  street: "Praça da Sé",
  number: "200",
  complement: "",
  district: "Sé",
  city: "São Paulo",
  state: "SP",
};

const V = "2026-10-28";

describe("mock account", () => {
  beforeEach(() => getMockStore().reset());

  it("reads and updates the profile, keeping the e-mail", async () => {
    const port = createMockAccount();
    expect(await port.profile("ana")).toMatchObject({
      id: "ana",
      email: "ana@teste.dev",
      cpf: "529.982.247-25",
    });
    await port.updateProfile("ana", { name: "Ana Maria", phone: "(11) 90000-0000", cpf: null });
    expect(await port.profile("ana")).toMatchObject({
      name: "Ana Maria",
      phone: "(11) 90000-0000",
      cpf: null,
      email: "ana@teste.dev",
    });
  });

  it("changes the password only when the current one is right", async () => {
    const port = createMockAccount();
    expect(await port.changePassword("ana", "errada", "Nova@1234")).toEqual({ ok: false });
    expect(await mockAuthInJar().signIn("ana@teste.dev", "Senha@123", false)).not.toBeNull();
    expect(await port.changePassword("ana", "Senha@123", "Nova@1234")).toEqual({ ok: true });
    expect(await mockAuthInJar().signIn("ana@teste.dev", "Nova@1234", false)).not.toBeNull();
    expect(await mockAuthInJar().signIn("ana@teste.dev", "Senha@123", false)).toBeNull();
  });

  it("keeps exactly one default address and promotes another when it is removed", async () => {
    const port = createMockAccount();
    const added = await port.upsertAddress("ana", home);
    expect(added.id).toBeTruthy();
    expect(added.isDefault).toBe(false);
    await port.setDefaultAddress("ana", added.id as string);
    let list = await port.addresses("ana");
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual([added.id]);
    await port.deleteAddress("ana", added.id as string);
    list = await port.addresses("ana");
    expect(list).toHaveLength(1);
    expect(list[0]?.isDefault).toBe(true);
  });

  it("never touches another user's address", async () => {
    const port = createMockAccount();
    await port.deleteAddress("bruno", "ana-casa");
    await port.setDefaultAddress("bruno", "ana-casa");
    expect(await port.addresses("ana")).toHaveLength(1);
    expect(await port.addresses("bruno")).toEqual([]);
    await port.upsertAddress("bruno", { ...home, id: "ana-casa", street: "Hackeada" });
    expect((await port.addresses("ana"))[0]?.street).toBe("Praça da Sé");
  });

  it("appends consent records and never rewrites old ones", async () => {
    const port = createMockAccount();
    await port.setConsent("ana", "email_marketing", true, V);
    await port.setConsent("ana", "email_marketing", false, V);
    const records = await port.consents("ana");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ granted: true, revokedAt: null });
    expect(records[1]?.granted).toBe(false);
    expect(records[1]?.revokedAt).not.toBeNull();
  });

  it("stamps every consent record with the version passed, never a copied one", async () => {
    const port = createMockAccount();
    await port.setConsent("bruno", "email_marketing", true, "v1");
    await port.setConsent("bruno", "email_marketing", false, "v2");
    await port.setConsent("bruno", "email_marketing", true, "v3");
    const records = await port.consents("bruno");
    expect(records.map((r) => r.version)).toEqual(["v1", "v2", "v3"]);
    expect(records.every((r) => r.version !== "")).toBe(true);
  });

  it("keeps one default when the default address is edited with principal unchecked", async () => {
    const port = createMockAccount();
    const [only] = await port.addresses("ana");
    await port.upsertAddress("ana", { ...only, isDefault: false });
    expect((await port.addresses("ana")).filter((a) => a.isDefault)).toHaveLength(1);

    const second = await port.upsertAddress("ana", { ...home, label: "Outro", isDefault: true });
    await port.upsertAddress("ana", { ...second, isDefault: false });
    const list = await port.addresses("ana");
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list.find((a) => a.id === second.id)?.isDefault).toBe(true);
  });

  it("refuses to disconnect the last way to sign in", async () => {
    const port = createMockAccount();
    expect(await port.connections("ana")).toEqual([{ provider: "google", email: "ana@teste.dev" }]);
    expect(await port.disconnect("ana", "google")).toEqual({ ok: true });
    expect(await port.connections("ana")).toEqual([]);
    await port.connect("ana", "facebook");
    getMockStore().users.find((u) => u.id === "ana")!.password = "";
    expect(await port.disconnect("ana", "facebook")).toEqual({ ok: false });
    expect(await port.connections("ana")).toHaveLength(1);
  });

  it("exports only the user's own data", async () => {
    const port = createMockAccount();
    await port.setConsent("ana", "email_marketing", true, V);
    const data = (await port.exportData("ana"))!;
    const text = JSON.stringify(data);
    expect(data.profile).toMatchObject({ email: "ana@teste.dev" });
    expect(text).not.toContain("bruno");
    expect(text).not.toContain("Senha@123");
  });

  it("does not delete anything when the password is wrong", async () => {
    const port = createMockAccount();
    expect(await port.deleteAccount("ana", "errada")).toEqual({ ok: false });
    expect(getMockStore().users.find((u) => u.id === "ana")).toBeDefined();
    expect(await port.addresses("ana")).toHaveLength(1);
  });

  it("deletes the account, anonymizes the orders and keeps other users", async () => {
    const orders = createMockOrders();
    const order = await orders.create(
      {
        userId: "ana",
        guestToken: null,
        paymentMethod: "pix",
        items: [],
        subtotalCents: null,
        shippingCents: null,
        discountCents: 0,
        totalCents: null,
        shippingAddress: { ...home },
        customer: { name: "Ana Souza", email: "ana@teste.dev", phone: "(11) 91234-5678", cpf: "x" },
        shippingService: "PAC",
      },
      "key-1",
    );
    const port = createMockAccount();
    await port.setConsent("ana", "email_marketing", true, V);
    expect(await port.deleteAccount("ana", "Senha@123")).toEqual({ ok: true });
    expect(getMockStore().users.find((u) => u.id === "ana")).toBeUndefined();
    expect(await mockAuthInJar().signIn("ana@teste.dev", "Senha@123", false)).toBeNull();
    expect(await port.addresses("ana")).toEqual([]);
    expect(await port.consents("ana")).toEqual([]);
    const kept = getMockStore().orders.find((o) => o.id === order.id);
    expect(kept?.userId).toBeNull();
    expect(kept?.customer.name).toBe("[removido]");
    expect(getMockStore().users.find((u) => u.id === "bruno")).toBeDefined();
  });

  it("exports returns, stock alerts (by id and by e-mail), newsletter and saved cart", async () => {
    const store = getMockStore();
    const delivered = store.orders.find((o) => o.userId === "ana" && o.status === "enviado");
    expect(delivered).toBeDefined();
    await createMockReturns().create("ana", {
      orderId: delivered!.id,
      reason: "defeito",
      description: "Veio com defeito",
      preference: "troca",
      photos: [new File(["0123456789"], "foto.jpg", { type: "image/jpeg" })],
    });
    const engagement = createMockEngagement();
    await engagement.requestStockAlert({
      userId: "ana",
      email: "outro@teste.dev",
      productId: "garota",
      consentedAt: "2026-10-28T00:00:00.000Z",
    });
    await engagement.requestStockAlert({
      userId: null,
      email: "ANA@teste.dev",
      productId: "e13",
      consentedAt: "2026-10-28T00:00:00.000Z",
    });
    await engagement.requestStockAlert({
      userId: null,
      email: "bruno@teste.dev",
      productId: "er",
      consentedAt: "2026-10-28T00:00:00.000Z",
    });
    await createMockNewsletter().subscribe({
      email: "ana@teste.dev",
      consent: true,
      consentVersion: V,
    });

    const data = (await createMockAccount().exportData("ana"))!;
    expect(data.returns).toHaveLength(1);
    expect(data.returns[0]).toMatchObject({
      description: "Veio com defeito",
      photos: [{ name: "foto.jpg", type: "image/jpeg", size: 10 }],
    });
    expect(data.stockAlerts.map((a) => a.productId).sort()).toEqual(["e13", "garota"]);
    expect(data.newsletter).toEqual({ email: "ana@teste.dev", consentVersion: V });
    expect(data.savedCart?.lines).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("bruno");
  });

  it("deletes returns and stock alerts of the user, also those made with the same e-mail", async () => {
    const store = getMockStore();
    const delivered = store.orders.find((o) => o.userId === "ana" && o.status === "enviado");
    await createMockReturns().create("ana", {
      orderId: delivered!.id,
      reason: "defeito",
      description: "x",
      preference: "troca",
      photos: [],
    });
    const engagement = createMockEngagement();
    const base = { productId: "garota", consentedAt: "2026-10-28T00:00:00.000Z" };
    await engagement.requestStockAlert({ userId: null, email: "ana@teste.dev", ...base });
    await engagement.requestStockAlert({ userId: null, email: "bruno@teste.dev", ...base });
    await createMockNewsletter().subscribe({
      email: "ana@teste.dev",
      consent: true,
      consentVersion: V,
    });
    expect(await createMockAccount().deleteAccount("ana", "Senha@123")).toEqual({ ok: true });
    expect(store.returns.filter((r) => r.userId === "ana")).toEqual([]);
    expect(store.stockAlerts.map((a) => a.email)).toEqual(["bruno@teste.dev"]);
    expect(store.newsletter).toEqual([]);
  });
});
