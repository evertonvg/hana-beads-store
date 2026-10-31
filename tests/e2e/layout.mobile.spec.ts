import { expect, expectA11y, test } from "./support/fixtures";
import { expectTouchTargets } from "./support/touch-targets";

test.describe("shell celular", () => {
  test("botao Abrir menu abre o dialog e Escape fecha", async ({ page }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Abrir menu" });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeAttached();
    await expect(dialog.getByRole("heading", { name: "Menu" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /^LOJA/ })).toHaveAttribute("href", "/loja");
    await expectA11y(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test("tab bar tem 4 links e marca Inicio na home", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "Atalhos" });
    await expect(tabs.getByRole("link")).toHaveCount(4);
    await expect(tabs.getByRole("link", { name: "INÍCIO" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(tabs.getByRole("link", { name: "LOJA" })).not.toHaveAttribute("aria-current");
  });

  test("sem overflow horizontal", async ({ page }) => {
    await page.goto("/");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("a11y da home com o shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expectA11y(page);
  });

  test("alvos de toque do menu aberto tem pelo menos 44px", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog.getByRole("link", { name: "ENTRAR" })).toBeVisible();
    await expectTouchTargets(dialog);
  });

  test("tab bar gruda no rodape da tela sem cobrir o conteudo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto("/rota-que-nao-existe");
    const bar = page.getByRole("navigation", { name: "Atalhos" });
    await expect(bar).toBeVisible();

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(1000);

    await page.evaluate(() =>
      window.scrollTo(0, Math.floor(document.documentElement.scrollHeight / 2)),
    );
    const mid = await bar.boundingBox();
    expect(mid && mid.y + mid.height).toBeGreaterThanOrEqual(499);
    expect(mid && mid.y + mid.height).toBeLessThanOrEqual(501);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const end = await bar.boundingBox();
    const last = await page.getByRole("contentinfo").locator("p").boundingBox();
    expect(end && end.y + end.height).toBeGreaterThanOrEqual(499);
    expect(last && last.y + last.height).toBeLessThanOrEqual((end?.y ?? 0) + 1);
  });

  for (const path of ["/carrinho", "/checkout", "/produto/x", "/pedido/x/pagamento"]) {
    test(`tab bar some em ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Atalhos" })).toHaveCount(0);
    });
  }

  test("tab bar existe numa rota comum (controle)", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByRole("navigation", { name: "Atalhos" })).toHaveCount(1);
  });
});
