import { expect, test as base, type Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";

import { consentCookieValue } from "../../e2e/support/fixtures";
import { gotoHydrated } from "../../e2e/support/hydration";

/** A fresh address per test: Mailpit and the per-e-mail rate limits never see it twice. */
export const uniqueEmail = (tag: string) => `e2e-${tag}-${randomUUID().slice(0, 8)}@teste.dev`;

/**
 * Each test comes from its own client IP (the server trusts x-forwarded-for here), so the per-IP
 * limits (20 per 15 min) never add up across tests. The cookie banner starts dismissed.
 */
export const test = base.extend<{ seedConsent: void }>({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    });
  },
  seedConsent: [
    async ({ context, baseURL }, use) => {
      await context.addCookies([
        { name: "pp_consent", value: consentCookieValue("rejected"), url: baseURL! },
      ]);
      await use();
    },
    { auto: true },
  ],
});

export const passwordField = (page: Page) => page.getByLabel("Senha", { exact: true });

/** Signs in through /entrar (waits for hydration so the click submits via React). */
export async function signIn(
  page: Page,
  email: string,
  password: string,
  { remember = false, next }: { remember?: boolean; next?: string } = {},
) {
  await gotoHydrated(page, next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await passwordField(page).fill(password);
  if (remember) await page.getByRole("checkbox", { name: "Manter conectado" }).click();
  await page.getByRole("button", { name: "ENTRAR", exact: true }).click();
}

export { expect, gotoHydrated };
