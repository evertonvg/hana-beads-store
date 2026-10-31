import type { Page } from "@playwright/test";
import { expect, expectA11y, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";
import { expectTouchTargets } from "./support/touch-targets";

const KEY = "pp_cart_v1";

type SeedLine = { productId: string; ring: "mosquetao" | "estrela"; qty: number };

const TWO_LINES: SeedLine[] = [
  { productId: "garota", ring: "mosquetao", qty: 1 },
  { productId: "er", ring: "estrela", qty: 1 },
];

async function seedCart(page: Page, lines: SeedLine[]) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ state: { lines }, version: 1 }),
  ] as [string, string]);
}

function cartLink(page: Page, isMobile: boolean, n: number) {
  const name = isMobile ? `Carrinho, ${n} ${n === 1 ? "item" : "itens"}` : `CARRINHO [${n}]`;
  return page.getByRole("link", { name });
}

const items = (page: Page) =>
  page.getByRole("list", { name: "Itens do carrinho" }).getByRole("listitem");
const summary = (page: Page) => page.getByRole("complementary", { name: "RESUMO" });
const total = (page: Page) => page.locator('[data-testid="cart-total"]:visible');

async function openCart(page: Page, lines: SeedLine[] = TWO_LINES) {
  await seedCart(page, lines);
  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { level: 1, name: "INVENTÁRIO" })).toBeVisible();
}

test("mostra as linhas do carrinho e o total como placeholder", async ({ page }) => {
  await openCart(page);
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).nth(0)).toContainText("GAROTA PIXEL");
  await expect(items(page).nth(0)).toContainText("★★★ ÉPICO");
  await expect(items(page).nth(0)).toContainText("Argola: mosquetão");
  await expect(items(page).nth(1)).toContainText("Argola: estrela");
  await expect(total(page)).toHaveText("R$ [VALOR]");
  await expect(summary(page).getByText("Subtotal", { exact: true }).locator("..")).toContainText(
    "[VALOR]",
  );
  await expect(page).toHaveTitle(/Inventário/);
  await snap(page, "carrinho");
});

test("passa na acessibilidade", async ({ page }) => {
  await openCart(page);
  await expect(items(page)).toHaveCount(2);
  await expectA11y(page);
  await expectTouchTargets(page.getByRole("main"));
});

test("+ aumenta a quantidade e o cabeçalho acompanha", async ({ page, isMobile }) => {
  await openCart(page);
  await expect(cartLink(page, isMobile, 2)).toBeVisible();
  await items(page).nth(0).getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(items(page).nth(0).getByRole("spinbutton")).toHaveValue("2");
  await expect(cartLink(page, isMobile, 3)).toBeVisible();
});

test("remover tira a linha e DESFAZER devolve na mesma posição", async ({ page }) => {
  await openCart(page);
  await page.getByRole("button", { name: "Remover GAROTA PIXEL" }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).nth(0)).toContainText("ESTRELA INICIAL");
  await page.getByRole("button", { name: "DESFAZER", exact: true }).click();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).nth(0)).toContainText("GAROTA PIXEL");
  await expect(items(page).nth(1)).toContainText("ESTRELA INICIAL");
});

test("CEP 01001-000 mostra duas opções de frete e escolher uma entra no resumo", async ({
  page,
}) => {
  await openCart(page);
  await page.getByLabel("CEP para o frete").fill("01001000");
  await page.getByRole("button", { name: /^OK/ }).click();
  const pac = page.getByRole("radio", { name: /PAC/ });
  await expect(pac).toBeVisible();
  await expect(page.getByRole("radio", { name: /SEDEX/ })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await pac.click();
  await expect(pac).toBeChecked();
  await expect(summary(page).getByText("Frete", { exact: true }).locator("..")).toContainText(
    "PAC",
  );
  const draft = await page.evaluate(() => sessionStorage.getItem("pp_checkout_draft"));
  expect(JSON.parse(draft ?? "{}")).toMatchObject({ cep: "01001-000", shippingId: "pac" });
});

test("CEP 00000-000 mostra CEP não atendido", async ({ page }) => {
  await openCart(page);
  await page.getByLabel("CEP para o frete").fill("00000000");
  await page.getByRole("button", { name: /^OK/ }).click();
  await expect(page.getByText("CEP não atendido")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});

test("CEP incompleto mostra CEP inválido", async ({ page }) => {
  await openCart(page);
  await page.getByLabel("CEP para o frete").fill("0100");
  await page.getByRole("button", { name: /^OK/ }).click();
  await expect(page.getByText(/CEP inválido/)).toBeVisible();
});

test("cupom TESTE10 aplicado aparece no resumo e pode ser removido", async ({ page }) => {
  await openCart(page);
  await page.getByLabel("Código secreto (cupom)").fill("teste10");
  await page.getByRole("button", { name: "APLICAR" }).click();
  await expect(summary(page).getByText("TESTE10")).toBeVisible();
  await expect(summary(page).getByText("[desconto]")).toBeVisible();
  await page.getByRole("button", { name: "REMOVER CUPOM" }).click();
  await expect(summary(page).getByText("TESTE10")).toHaveCount(0);
});

test("cupom EXPIRADO e cupom desconhecido mostram erro", async ({ page }) => {
  await openCart(page);
  const field = page.getByLabel("Código secreto (cupom)");
  await field.fill("EXPIRADO");
  await page.getByRole("button", { name: "APLICAR" }).click();
  await expect(page.getByText("Esse código expirou.")).toBeVisible();
  await field.fill("NAOEXISTE");
  await page.getByRole("button", { name: "APLICAR" }).click();
  await expect(page.getByText("Código secreto inválido.")).toBeVisible();
  await expect(summary(page).getByText("EXPIRADO")).toHaveCount(0);
});

test("id inexistente no storage é podado sem erro e o cabeçalho acompanha", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedCart(page, [
    { productId: "nao-existe", ring: "mosquetao", qty: 1 },
    { productId: "garota", ring: "mosquetao", qty: 1 },
  ]);
  await page.goto("/carrinho");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).nth(0)).toContainText("GAROTA PIXEL");
  await expect(cartLink(page, isMobile, 1)).toBeVisible();
  expect(errors).toEqual([]);
});

test("esvaziar mostra INVENTÁRIO VAZIO com 3 sugestões", async ({ page }) => {
  await openCart(page, [{ productId: "garota", ring: "mosquetao", qty: 1 }]);
  await page.getByRole("button", { name: "Remover GAROTA PIXEL" }).click();
  await expect(page.getByRole("heading", { name: "INVENTÁRIO VAZIO" })).toBeVisible();
  const suggestions = page.getByRole("region", { name: /COMECE POR AQUI/ });
  await expect(suggestions.getByRole("link")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "IR PARA A LOJA" })).toHaveAttribute("href", "/loja");
});

test("carrinho vazio: visual e acessibilidade", async ({ page }) => {
  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { name: "INVENTÁRIO VAZIO" })).toBeVisible();
  await expect(page.getByRole("region", { name: /COMECE POR AQUI/ }).getByRole("link")).toHaveCount(
    3,
  );
  await expectA11y(page);
  await snap(page, "carrinho-vazio");
});

test("FINALIZAR leva a /checkout", async ({ page }) => {
  await openCart(page);
  const finalizar = page.getByRole("link", { name: /FINALIZAR/ });
  await expect(finalizar).toHaveAttribute("href", "/checkout");
  await finalizar.click();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("CONTINUAR JOGANDO leva a /loja", async ({ page }) => {
  await openCart(page);
  await expect(page.getByRole("link", { name: /CONTINUAR JOGANDO/ })).toHaveAttribute(
    "href",
    "/loja",
  );
});

test("adicionar na página do produto mostra o item no carrinho", async ({ page }) => {
  await gotoHydrated(page, "/produto/garota-pixel");
  await page.getByRole("button", { name: "+ PEGAR ITEM" }).click();
  await page
    .getByRole("dialog", { name: "ITEM COLETADO!" })
    .getByRole("link", { name: "VER CARRINHO" })
    .click();
  await expect(page).toHaveURL(/\/carrinho$/);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).nth(0)).toContainText("GAROTA PIXEL");
});
