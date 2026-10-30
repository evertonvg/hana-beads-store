import { expect, login, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

test("o botão troca DETALHES ▼ por FECHAR ▲", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta/pedidos");
  const card = page.getByRole("article").filter({ hasText: "#0003" });
  const button = card.getByRole("button", { name: "DETALHES ▼" });
  await button.click();
  await expect(card.getByRole("button", { name: "FECHAR ▲" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(card.getByRole("heading", { name: "ENTREGA" })).toBeVisible();
  await expect(card.getByRole("heading", { name: "PAGAMENTO" })).toBeVisible();
  await expect(card.getByText(/Nota fiscal/)).toBeVisible();
});

test("o menu da conta marca PEDIDOS como a página atual", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta/pedidos");
  const nav = page.getByRole("navigation", { name: "Minha conta" });
  await expect(nav.getByRole("link", { name: "PEDIDOS" })).toHaveAttribute("aria-current", "page");
});
