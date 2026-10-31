import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

async function openCheckout(page: Page) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    "pp_cart_v1",
    JSON.stringify({
      state: { lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }] },
      version: 1,
    }),
  ] as [string, string]);
  await gotoHydrated(page, "/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "SAVE GAME" })).toBeVisible();
}

test("barra fixa mostra o total e o botão SAVE GAME", async ({ page }) => {
  await openCheckout(page);
  const bar = page.getByTestId("checkout-bar");
  await expect(bar).toBeVisible();
  await expect(bar.getByTestId("checkout-total")).toHaveText("R$ [VALOR]");
  const button = bar.getByRole("button", { name: "SAVE GAME" });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  // Stuck to the bottom of the viewport even though the page is taller than the screen.
  const viewport = page.viewportSize();
  const barBox = await bar.boundingBox();
  expect((barBox?.y ?? 0) + (barBox?.height ?? 0)).toBeCloseTo(viewport?.height ?? 0, 0);
});

test("campos têm fonte de pelo menos 16px", async ({ page }) => {
  await openCheckout(page);
  const sizes = await page
    .locator("main input:not([type=hidden]):not([type=checkbox])")
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(sizes.length).toBeGreaterThan(8);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});
