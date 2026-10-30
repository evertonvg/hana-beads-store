import { describe, expect, it } from "vitest";
import { contactLabel, getContact } from "@/lib/contact";
import type { PublicEnv } from "@/lib/env";

const env: PublicEnv = {
  siteUrl: "http://localhost:3000",
  contactChannel: "instagram",
  instagramUser: "pixelperfect.teste",
  whatsappNumber: null,
  freeShippingCents: null,
  parallaxIntensity: 1,
  authApple: false,
  analyticsSrc: null,
};

describe("getContact", () => {
  it("builds the Instagram direct link without prefill", () => {
    const c = getContact(env);
    expect(c.id).toBe("instagram");
    expect(c.href()).toBe("https://ig.me/m/pixelperfect.teste");
    expect(c.acceptsPrefill).toBe(false);
  });

  it("uses the username placeholder when Instagram user is empty", () => {
    expect(getContact({ ...env, instagramUser: null }).href()).toBe("https://ig.me/m/[usuario]");
  });

  it("strips formatting from the WhatsApp number", () => {
    const c = getContact({
      ...env,
      contactChannel: "whatsapp",
      whatsappNumber: "+55 11 99999-9999",
    });
    expect(c.href("Oi! Quero")).toBe("https://wa.me/5511999999999?text=Oi!%20Quero");
  });

  it("builds the WhatsApp link with an encoded prefilled message", () => {
    const c = getContact({
      ...env,
      contactChannel: "whatsapp",
      whatsappNumber: "5511999999999",
    });
    expect(c.id).toBe("whatsapp");
    expect(c.acceptsPrefill).toBe(true);
    expect(c.href("Oi! Quero")).toBe("https://wa.me/5511999999999?text=Oi!%20Quero");
    expect(c.href()).toBe("https://wa.me/5511999999999?text=");
  });
});

describe("getContact text fields", () => {
  it("names Instagram for running text, with the @handle", () => {
    const c = getContact(env);
    expect([c.name, c.direct, c.via, c.handle]).toEqual([
      "Instagram",
      "Direct",
      "Direct do Instagram",
      "@pixelperfect.teste",
    ]);
    expect(getContact({ ...env, instagramUser: null }).handle).toBe("@[usuario]");
  });

  it("names WhatsApp for running text, with the number", () => {
    const c = getContact({
      ...env,
      contactChannel: "whatsapp",
      whatsappNumber: "+55 11 99999-9999",
    });
    expect([c.name, c.direct, c.via, c.handle]).toEqual([
      "WhatsApp",
      "WhatsApp",
      "WhatsApp",
      "+55 11 99999-9999",
    ]);
    expect(getContact({ ...env, contactChannel: "whatsapp" }).handle).toBe("[numero]");
  });
});

describe("contactLabel", () => {
  it("uses DIRECT for Instagram", () => {
    const c = getContact(env);
    expect(contactLabel("chamar", c)).toBe("CHAMAR NO DIRECT");
    expect(contactLabel("encomendar", c)).toBe("ENCOMENDAR PELO DIRECT");
    expect(contactLabel("falar", c)).toBe("FALAR NO DIRECT");
    expect(contactLabel("ver", c)).toBe("VER NO DIRECT");
  });

  it("swaps DIRECT for WHATSAPP when WhatsApp is the channel", () => {
    const c = getContact({ ...env, contactChannel: "whatsapp", whatsappNumber: "5511999999999" });
    expect(contactLabel("chamar", c)).toBe("CHAMAR NO WHATSAPP");
    expect(contactLabel("encomendar", c)).toBe("ENCOMENDAR PELO WHATSAPP");
    expect(contactLabel("falar", c)).toBe("FALAR NO WHATSAPP");
    expect(contactLabel("ver", c)).toBe("VER NO WHATSAPP");
  });
});
