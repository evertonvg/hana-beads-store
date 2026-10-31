import type { Page } from "@playwright/test";
import { gotoHydrated } from "./support/hydration";
import { expect, test } from "./support/fixtures";

const KEY = "pp_cart_v1";

/** Header cart link: yellow button on desktop, icon with badge on mobile. */
function cartLink(page: Page, isMobile: boolean, n: number) {
  const name = isMobile ? `Carrinho, ${n} ${n === 1 ? "item" : "itens"}` : `CARRINHO [${n}]`;
  return page.getByRole("link", { name });
}

function persisted(lines: { productId: string; ring: string; qty: number }[]) {
  return JSON.stringify({ state: { lines }, version: 1 });
}

test("corrupted storage falls back to an empty cart and the store stays alive", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // HTTP failures are reported through the response listener below, with their URL.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
      errors.push(`console: ${m.text()}`);
    }
  });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    errors.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.addInitScript((key) => localStorage.setItem(key, "{lixo"), KEY);
  await page.goto("/");
  await expect(cartLink(page, isMobile, 0)).toBeVisible();
  await expect(page.locator("main")).toBeVisible();

  // Prove hydration finished and the store is alive: the real add-to-cart flow must update it.
  await gotoHydrated(page, "/produto/garota-pixel");
  await page.getByRole("button", { name: "+ PEGAR ITEM" }).click();
  await page
    .getByRole("dialog", { name: "ITEM COLETADO!" })
    .getByRole("button", { name: /CONTINUAR JOGANDO/ })
    .click();
  await expect(cartLink(page, isMobile, 1)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a valid persisted cart shows the sum of quantities", async ({ page, isMobile }) => {
  const value = persisted([
    { productId: "garota", ring: "mosquetao", qty: 1 },
    { productId: "er", ring: "estrela", qty: 2 },
  ]);
  await page.addInitScript(([key, v]) => localStorage.setItem(key, v), [KEY, value] as [
    string,
    string,
  ]);
  await page.goto("/");
  await expect(cartLink(page, isMobile, 3)).toBeVisible();
});

test("a change made in another tab updates the counter", async ({ page, context, isMobile }) => {
  await page.goto("/");
  await expect(cartLink(page, isMobile, 0)).toBeVisible();

  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(([key, v]) => localStorage.setItem(key, v), [
    KEY,
    persisted([{ productId: "garota", ring: "estrela", qty: 4 }]),
  ] as [string, string]);
  await expect(cartLink(page, isMobile, 4)).toBeVisible();
});
