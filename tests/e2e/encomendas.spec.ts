import { expect, expectA11y, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

const HREF = "https://ig.me/m/pixelperfect.teste";
const SUGGESTED = "Oi! Quero encomendar um chaveiro: [ideia], cores [ ], para [data]";

test("todos os CTAs de contato abrem o canal configurado em nova aba", async ({ page }) => {
  await page.goto("/encomendas");
  const ctas = page.getByRole("main").locator(`a[href="${HREF}"]`);
  expect(await ctas.count()).toBeGreaterThanOrEqual(2);
  for (const cta of await ctas.all()) {
    await expect(cta).toHaveAttribute("target", "_blank");
  }
  const contactLinks = page.getByRole("main").locator('a[href*="ig.me"]');
  await expect(contactLinks).toHaveCount(await ctas.count());
});

test("a mensagem sugerida é copiada exatamente", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoHydrated(page, "/encomendas");
  const main = page.getByRole("main");
  await expect(main.getByText(SUGGESTED, { exact: true })).toBeVisible();
  await main.getByRole("button", { name: "COPIAR" }).first().click();
  await expect(main.getByRole("button", { name: "COPIADO ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SUGGESTED);
});

test("traz o exemplo de conversa, as 4 fases e o checklist", async ({ page }) => {
  await page.goto("/encomendas");
  await expect(page.getByLabel("Exemplo ilustrativo de conversa")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TEM UMA IDEIA?");
  for (const n of [1, 2, 3, 4]) await expect(page.getByText(`FASE ${n}`)).toBeVisible();
  await expect(page.getByText("ANTES DE CHAMAR, TENHA EM MÃOS")).toBeVisible();
});

test("o FAQ abre e fecha, e mantém o prazo como placeholder", async ({ page }) => {
  await gotoHydrated(page, "/encomendas");
  const q = page.getByRole("button", { name: "QUANTO TEMPO DEMORA?" });
  await expect(q).toHaveAttribute("aria-expanded", "false");
  await q.click();
  await expect(q).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("[prazo]")).toBeVisible();
  await q.click();
  await expect(q).toHaveAttribute("aria-expanded", "false");
  for (const name of ["QUANTO CUSTA?", "COMO PAGO?", "FAZEM PEDIDOS EM QUANTIDADE?"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});

test("sem overflow horizontal no celular e na tela larga", async ({ page }) => {
  await page.goto("/encomendas");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("encomendas passa na acessibilidade", async ({ page }) => {
  await page.goto("/encomendas");
  await expectA11y(page);
  await snap(page, "encomendas");
});
