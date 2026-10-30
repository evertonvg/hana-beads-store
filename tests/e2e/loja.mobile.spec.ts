import { expect, expectA11y, snap, test } from "./support/fixtures";
import { expectTouchTargets } from "./support/touch-targets";
import type { Page } from "@playwright/test";

const cards = (page: Page) => page.getByRole("main").getByRole("article");

test("chip BICHINHOS mostra 1 item e a categoria curta INICIAIS", async ({ page }) => {
  await page.goto("/loja");
  await expect(page.getByRole("button", { name: "INICIAIS", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "BICHINHOS", exact: true }).click();
  await expect(page).toHaveURL(/categoria=bichinhos/);
  await expect(cards(page)).toHaveCount(1);
});

test("FILTRAR abre a folha, aplicar cor mostra 1 item e fecha", async ({ page }) => {
  await page.goto("/loja");
  await page.getByRole("button", { name: "FILTRAR" }).click();
  const sheet = page.getByRole("dialog", { name: "FILTRAR" });
  await expect(sheet).toBeAttached();
  await expect(sheet.getByRole("heading", { name: "FILTRAR" })).toBeVisible();
  // Focus moves into the sheet when it opens (the trap keeps it there).
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
    .toBe(true);
  await expectTouchTargets(sheet);
  await sheet.getByRole("button", { name: "Laranja" }).click();
  // nothing is applied until APLICAR
  await expect(page).toHaveURL(/\/loja$/);
  await expectA11y(page);
  await snap(page, "loja-filtros", { fullPage: false });
  await sheet.getByRole("button", { name: "APLICAR" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/cor=laranja/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("GATINHO PIXEL");
});

test("fechar a folha descarta a escolha", async ({ page }) => {
  await page.goto("/loja");
  await page.getByRole("button", { name: "FILTRAR" }).click();
  const sheet = page.getByRole("dialog", { name: "FILTRAR" });
  await sheet.getByRole("button", { name: "Rosa" }).click();
  await sheet.getByRole("button", { name: "Fechar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "FILTRAR" })).toBeFocused();
  await expect(page).toHaveURL(/\/loja$/);
  await expect(cards(page)).toHaveCount(9);
});

test("ORDENAR abre a folha e aplica Novidades", async ({ page }) => {
  await page.goto("/loja");
  await page.getByRole("button", { name: "ORDENAR" }).click();
  const sheet = page.getByRole("dialog", { name: "ORDENAR" });
  await sheet.getByRole("radio", { name: "Novidades" }).click();
  await sheet.getByRole("button", { name: "APLICAR" }).click();
  await expect(page).toHaveURL(/ordem=novo/);
  await expect(cards(page).first()).toContainText("SORVETE PIXEL");
});

test("alvos de toque e sem overflow horizontal", async ({ page }) => {
  await page.goto("/loja");
  await expect(cards(page)).toHaveCount(9);
  await expectTouchTargets(page.getByRole("main"));
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test("loja celular passa na acessibilidade", async ({ page }) => {
  await page.goto("/loja");
  await expectA11y(page);
  await snap(page, "loja");
});
