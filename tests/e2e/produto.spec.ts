import type { Page } from "@playwright/test";
import { expect, expectA11y, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

const PRODUCT = "/produto/garota-pixel";

function cartLink(page: Page, isMobile: boolean, n: number) {
  const name = isMobile ? `Carrinho, ${n} ${n === 1 ? "item" : "itens"}` : `CARRINHO [${n}]`;
  return page.getByRole("link", { name });
}

const addButton = (page: Page) => page.getByRole("button", { name: "+ PEGAR ITEM" });

async function pickEstrelaTimes2(page: Page) {
  await page.getByRole("radio", { name: "ESTRELA" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(page.getByRole("spinbutton", { name: /quantidade/i })).toHaveValue("2");
}

test("mostra nome, raridade e preço placeholder", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  await expect(page.getByRole("heading", { level: 1, name: "GAROTA PIXEL" })).toBeVisible();
  await expect(page.getByText("★★★ ÉPICO").first()).toBeVisible();
  await expect(page.getByRole("main").getByText("[PREÇO]").first()).toBeVisible();
  await expect(page).toHaveTitle("GAROTA PIXEL — Pixel Perfect");
  await expect(page.getByRole("heading", { name: /VOCÊ TAMBÉM PODE/ })).toBeVisible();
  await expect(page.getByText("TAMANHO", { exact: true })).toBeVisible();
  await expect(page.getByText("[X] cm")).toBeVisible();
  await expect(page.getByText("[000]")).toBeVisible();
  await expect(page.getByText("MAX", { exact: true })).toBeVisible();
  await snap(page, "produto");
});

test("passa na acessibilidade", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  await expectA11y(page);
});

test("ESTRELA x2 abre ITEM COLETADO! com argola e quantidade, e atualiza o carrinho", async ({
  page,
  isMobile,
}) => {
  await gotoHydrated(page, PRODUCT);
  await expect(cartLink(page, isMobile, 0)).toBeVisible();
  await pickEstrelaTimes2(page);
  await addButton(page).click();

  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  await expect(dialog).toBeAttached();
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  await expect(dialog).toContainText("Argola: estrela");
  await expect(dialog).toContainText("×2");
  await expect(dialog.getByText("[Faltam R$ X para frete grátis]")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /FINALIZAR COMPRA/ })).toHaveAttribute(
    "href",
    "/checkout",
  );
  await expectA11y(page);
  await snap(page, "produto-gaveta", { fullPage: false });

  await dialog.getByRole("button", { name: /CONTINUAR JOGANDO/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cartLink(page, isMobile, 2)).toBeVisible();
});

test("duplo clique rápido adiciona a quantidade uma única vez", async ({ page, isMobile }) => {
  await gotoHydrated(page, PRODUCT);
  await pickEstrelaTimes2(page);
  await addButton(page).dblclick();

  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  await expect(dialog).toBeAttached();
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(cartLink(page, isMobile, 2)).toBeVisible();
  await expect(cartLink(page, isMobile, 4)).toHaveCount(0);
});

test("Escape fecha a gaveta e devolve o foco ao botão", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  await addButton(page).click();
  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  await expect(dialog).toBeAttached();
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(addButton(page)).toBeFocused();
});

test("VER CARRINHO leva a /carrinho", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  await addButton(page).click();
  await page
    .getByRole("dialog", { name: "ITEM COLETADO!" })
    .getByRole("link", { name: "VER CARRINHO" })
    .click();
  await expect(page).toHaveURL(/\/carrinho$/);
});

test("slug inexistente mostra a página 404 com noindex", async ({ page, request }) => {
  // Under cacheComponents an unknown param is served from the fallback shell, so the 404 is
  // streamed (HTTP 200); Next marks it noindex.
  const r = await request.get("/produto/nao-existe");
  expect(await r.text()).toContain('<meta name="robots" content="noindex"/>');
  await page.goto("/produto/nao-existe");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("FASE NÃO ENCONTRADA");
  await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
});

test("a gaveta lista todas as linhas do carrinho com o subtotal", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  await addButton(page).click();
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  await expect(dialog.getByText("+1 NO INVENTÁRIO")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.getByRole("radio", { name: "ESTRELA" }).click();
  await addButton(page).click();
  const items = dialog.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Argola: mosquetão");
  await expect(items.nth(1)).toContainText("Argola: estrela");
  await expect(items.nth(1)).toContainText("×1");
  await expect(dialog.getByText("SUBTOTAL · 2 ITENS")).toBeVisible();
  await expect(dialog.getByText("[VALOR]").last()).toBeVisible();
});

test("linha de outro produto mostra nome real e preço [VALOR] enquanto o preço é placeholder", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "pp_cart_v1",
      JSON.stringify({
        state: { lines: [{ productId: "e13", ring: "estrela", qty: 1 }] },
        version: 1,
      }),
    ),
  );
  await gotoHydrated(page, PRODUCT);
  await addButton(page).click();
  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  const items = dialog.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("ESTRELA Nº");
  await expect(items.nth(0)).toContainText("[VALOR]");
  await expect(dialog.getByText("SUBTOTAL · 2 ITENS")).toBeVisible();
});

test("clique no fundo logo após abrir não fecha; depois da janela de guarda fecha", async ({
  page,
}) => {
  await gotoHydrated(page, PRODUCT);
  await addButton(page).click();
  const dialog = page.getByRole("dialog", { name: "ITEM COLETADO!" });
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  // top-left corner: always the backdrop (the drawer is on the right, the sheet at the bottom)
  await page.mouse.click(4, 4);
  await expect(dialog.getByRole("heading", { name: "ITEM COLETADO!" })).toBeVisible();
  // eslint-disable-next-line playwright/no-wait-for-timeout -- the guard window is a fixed 400 ms timer
  await page.waitForTimeout(600);
  await page.mouse.click(4, 4);
  await expect(dialog).toHaveCount(0);
});

test("produto esgotado mostra ESGOTADO e AVISE-ME no lugar de + PEGAR ITEM", async ({ page }) => {
  await page.goto("/produto/planeta-pixel");
  await expect(page.getByRole("heading", { level: 1, name: "PLANETA PIXEL" })).toBeVisible();
  await expect(page.getByText("ESGOTADO", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "AVISE-ME" })).toBeVisible();
  await expect(addButton(page)).toHaveCount(0);
  await expectA11y(page);
});

test("acordeão CUIDADOS alterna aria-expanded", async ({ page }) => {
  await gotoHydrated(page, PRODUCT);
  const trigger = page.getByRole("button", { name: "CUIDADOS" });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "ENVIO E TROCAS" }).click();
  await expect(page.getByRole("link", { name: "Ver política de trocas" })).toHaveAttribute(
    "href",
    "/trocas",
  );
});
