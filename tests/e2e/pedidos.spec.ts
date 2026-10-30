import type { Page } from "@playwright/test";
import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

const cards = (page: Page) => page.getByRole("article");
const card = (page: Page, n: string) => cards(page).filter({ hasText: `#${n}` });
/** The visible toggle of a card: "DETALHES" on the computer, the whole summary on the phone. */
const toggle = (page: Page, n: string) => card(page, n).locator("button[aria-expanded]:visible");

async function openPedidos(page: Page, query = "", user: "ana" | "bruno" = "ana") {
  await login(page, user);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, `/conta/pedidos${query}`);
}

test("a conta da ana lista os 5 pedidos, o #0004 com o selo ENCOMENDA", async ({ page }) => {
  await openPedidos(page);
  await expect(page.getByText("HISTÓRICO DE PARTIDAS")).toBeVisible();
  await expect(cards(page)).toHaveCount(5);
  const seal = (n: string) =>
    card(page, n).getByText("ENCOMENDA", { exact: true }).filter({ visible: true });
  await expect(seal("0004")).toBeVisible();
  await expect(seal("0005")).toHaveCount(0);
});

test("os filtros mostram contadores e filtram pela URL", async ({ page }) => {
  await openPedidos(page);
  const nav = page.getByRole("navigation", { name: "Filtrar pedidos" });
  await expect(nav.getByRole("link", { name: "TODOS · 5" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "EM ANDAMENTO · 3" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "CANCELADOS · 1" })).toBeVisible();
  await nav.getByRole("link", { name: "ENTREGUES · 1" }).click();
  await expect(page).toHaveURL(/\/conta\/pedidos\?filtro=entregues$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, "0002")).toBeVisible();
});

test("?filtro= na URL abre direto no filtro", async ({ page }) => {
  await openPedidos(page, "?filtro=cancelados");
  await expect(cards(page)).toHaveCount(1);
  await expect(card(page, "0001")).toBeVisible();
});

test("a busca por produto filtra os pedidos", async ({ page }) => {
  await openPedidos(page);
  await page.getByLabel("Buscar por número ou produto").fill("estrela");
  await expect(cards(page)).toHaveCount(3);
  await expect(page).toHaveURL(/q=estrela/);
  await page.getByLabel("Buscar por número ou produto").fill("0004");
  await expect(cards(page)).toHaveCount(1);
});

test("filtro sem resultado mostra a mensagem", async ({ page }) => {
  await openPedidos(page, "?filtro=entregues");
  await page.getByLabel("Buscar por número ou produto").fill("estrela");
  await expect(page.getByText("NENHUM PEDIDO AQUI")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test("DETALHES alterna aria-expanded e mostra o rastreio do #0003", async ({ page }) => {
  await openPedidos(page);
  await expect(toggle(page, "0003")).toHaveAttribute("aria-expanded", "false");
  await expect(card(page, "0003").getByText("[AA000000000BR]")).toBeHidden();
  await toggle(page, "0003").click();
  await expect(toggle(page, "0003")).toHaveAttribute("aria-expanded", "true");
  await expect(card(page, "0003").getByText("[AA000000000BR]")).toBeVisible();
  await expect(
    card(page, "0003")
      .getByRole("link", { name: /Solicitar troca/ })
      .first(),
  ).toHaveAttribute("href", /\/trocas\?pedido=ord_0003$/);
  await toggle(page, "0003").click();
  await expect(toggle(page, "0003")).toHaveAttribute("aria-expanded", "false");
});

test("o bruno não tem partidas e não vê os pedidos da ana", async ({ page }) => {
  await openPedidos(page, "", "bruno");
  await expect(page.getByText(/nenhuma partida ainda/i)).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("#0003")).toHaveCount(0);
});

test("o bruno recebe 404 ao abrir o pagamento de um pedido da ana", async ({ page }) => {
  await login(page, "bruno");
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto("/pedido/ord_0003/pagamento");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("FASE NÃO ENCONTRADA");
});

test("sem sessão, vai para o login lembrando o filtro", async ({ page }) => {
  await page.goto("/conta/pedidos?filtro=entregues");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fconta%2Fpedidos%3Ffiltro%3Dentregues$/);
});

test("acessibilidade e visual", async ({ page }) => {
  await openPedidos(page);
  await expect(cards(page)).toHaveCount(5);
  await expectA11y(page);
  await snap(page, "pedidos");
  await toggle(page, "0003").click();
  await expectA11y(page);
});
