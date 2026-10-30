import { expect, login, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

test("o resumo do cartão é o botão, com a seta e o rótulo curto", async ({ page }) => {
  await login(page, "ana");
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/conta/pedidos");
  await expect(page.getByRole("link", { name: "Voltar para minha conta" })).toHaveAttribute(
    "href",
    "/conta",
  );
  const card = page.getByRole("article").filter({ hasText: "#0004" });
  await expect(card.getByText("APROVAR DESENHO")).toBeVisible();
  const summary = card.locator("button[aria-expanded]:visible");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(summary).toContainText("▼");
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(summary).toContainText("▲");
});
