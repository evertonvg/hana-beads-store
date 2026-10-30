import { expect, expectA11y, snap, test } from "./support/fixtures";

test("privacidade: índice leva à seção de direitos", async ({ page }) => {
  await page.goto("/privacidade");
  const toc = page.getByRole("navigation", { name: "Nesta página" });
  expect(await toc.getByRole("link").count()).toBeGreaterThanOrEqual(1);
  await toc.getByRole("link", { name: /Seus direitos/ }).click();
  await expect(page).toHaveURL(/#direitos$/);
  await expect(page.locator("#direitos")).toBeInViewport();
  await expect(page.getByRole("heading", { level: 2, name: /SEUS DIREITOS/ })).toBeVisible();
});

test("privacidade: texto literal com placeholders e canal via <Canal/>", async ({ page }) => {
  await page.goto("/privacidade");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("POLÍTICA DE PRIVACIDADE");
  await expect(main.getByText("[razão social]").first()).toBeVisible();
  await expect(main.getByText("[00.000.000/0000-00]").first()).toBeVisible();
  await expect(main.getByText("[privacidade@seudominio.com.br]").first()).toBeVisible();
  await expect(main.getByText("[Intermediador de pagamento]").first()).toBeVisible();
  await expect(main.getByText("Instagram").first()).toBeVisible();
  await expect(main.getByText("CONFIRMAÇÃO E ACESSO")).toBeVisible();
  await expect(main.getByText("OPOSIÇÃO", { exact: true })).toBeVisible();
});

test("privacidade: links do banner, do rodapé e da conta chegam aqui", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacidade" }),
  ).toBeVisible();
  const res = await page.request.get("/privacidade");
  expect(res.status()).toBe(200);
});

test("termos: REGRAS DO JOGO e 12 seções", async ({ page }) => {
  await page.goto("/termos");
  const main = page.getByRole("main");
  await expect(main.getByText("REGRAS DO JOGO", { exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { level: 1 })).toContainText("TERMOS DE USO");
  await expect(main.getByRole("heading", { level: 2 })).toHaveCount(12);
  await expect(main.getByText("[razão social]").first()).toBeVisible();
  const toc = page.getByRole("navigation", { name: "Nesta página" });
  await toc.getByRole("link", { name: /Entrega/ }).click();
  await expect(page.locator("#t7")).toBeInViewport();
});

test("privacidade: sem violações de acessibilidade", async ({ page }) => {
  await page.goto("/privacidade");
  await expectA11y(page);
  await snap(page, "privacidade");
});

test("termos: sem violações de acessibilidade", async ({ page }) => {
  await page.goto("/termos");
  await expectA11y(page);
  await snap(page, "termos");
});
