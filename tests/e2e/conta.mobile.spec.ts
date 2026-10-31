import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

const ITEMS = [
  "Meus pedidos",
  "Meus dados",
  "Endereços",
  "Contas conectadas",
  "Privacidade e dados",
  "Trocas e devoluções",
  "Ajuda",
];

test("/conta sem aba mostra o menu com os 7 itens e SAIR", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta");
  const nav = page.getByRole("navigation", { name: "Opções da conta" });
  await expect(nav.getByRole("link")).toHaveCount(7);
  for (const name of ITEMS) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "SAIR" })).toBeVisible();
  await expectA11y(page);
  await snap(page, "conta-menu");
});

test("Meus pedidos abre /conta/pedidos e Meus dados abre a aba", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta");
  await page.getByRole("link", { name: /^Meus dados/ }).click();
  await expect(page).toHaveURL(/\/conta\?aba=dados$/);
  await expect(page.getByRole("link", { name: "‹ MINHA CONTA" })).toBeVisible();
  await gotoHydrated(page, "/conta");
  await page.getByRole("link", { name: /^Meus pedidos/ }).click();
  await expect(page).toHaveURL(/\/conta\/pedidos$/);
});

test("SAIR encerra a sessão", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta");
  await page.getByRole("button", { name: "SAIR" }).click();
  await expect(page).toHaveURL(/\/$/);
  await gotoHydrated(page, "/conta");
  await expect(page).toHaveURL(/\/entrar/);
});
