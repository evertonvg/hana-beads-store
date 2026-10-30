import type { Page } from "@playwright/test";
import { expect, expectA11y, snap, test } from "./support/fixtures";
import {
  expireServerPix,
  orderIdOf,
  placeOrder,
  setOrderStatus,
  storedLines,
} from "./support/order";

const TIMER = /^(30:00|29:5\d)$/;

const copyName = (isMobile: boolean) => (isMobile ? "COPIAR CÓDIGO PIX" : "COPIAR");
const copiedName = (isMobile: boolean) => (isMobile ? "CÓDIGO COPIADO ✓" : "COPIADO ✓");

async function toPix(page: Page) {
  await placeOrder(page, "pix");
  await expect(page).toHaveURL(/\/pedido\/[^/]+\/pagamento$/);
  await expect(page.getByRole("heading", { level: 1, name: /PAGUE COM PIX/ })).toBeVisible();
}

/** Freezes the browser clock exactly 30 minutes before the Pix expires: the timer reads 30:00. */
async function freezePixTimer(page: Page) {
  const res = await page.request.get(`/api/__mock__/pedidos/${orderIdOf(page)}`);
  const order = (await res.json()) as { payment: { expiresAt: string } };
  await page.clock.setFixedTime(new Date(Date.parse(order.payment.expiresAt) - 30 * 60 * 1000));
}

test.describe("Pix", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("mostra o contador e copia o código", async ({ page, isMobile }) => {
    await toPix(page);
    await expect(page.getByTestId("pix-timer")).toHaveText(TIMER);
    await page.getByRole("button", { name: copyName(isMobile), exact: true }).click();
    await expect(
      page.getByRole("button", { name: copiedName(isMobile), exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("[codigo-pix]");
    await expect(page.getByText("Aguardando pagamento", { exact: false }).first()).toBeVisible();
  });

  test("quando o pagamento é aprovado, vai sozinho para a confirmação e esvazia o carrinho", async ({
    page,
  }) => {
    await toPix(page);
    expect(await storedLines(page)).toBe(1);
    const id = orderIdOf(page);
    await setOrderStatus(page, id, "pago");
    await expect(page).toHaveURL(new RegExp(`/pedido/${id}/confirmado$`), { timeout: 6000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("STAGE");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CLEAR!");
    await expect.poll(() => storedLines(page)).toBe(0);
  });

  test("expira em 30 minutos e gera um novo Pix sem perder o carrinho", async ({ page }) => {
    await page.clock.install();
    await toPix(page);
    await expect(page.getByTestId("pix-timer")).toHaveText(TIMER);
    await page.clock.fastForward("31:00");
    await expect(page.getByTestId("pix-timer")).toHaveText("00:00");
    // The server only renews a Pix that really expired there (the fake clock is only the browser's).
    await expireServerPix(page, orderIdOf(page));
    await page.getByRole("button", { name: "GERAR NOVO PIX" }).click();
    await expect(page.getByTestId("pix-timer")).toHaveText(TIMER);
    await expect(page.getByRole("button", { name: "GERAR NOVO PIX" })).toHaveCount(0);
    expect(await storedLines(page)).toBe(1);
  });

  test("passa na acessibilidade", async ({ page }) => {
    await toPix(page);
    await expectA11y(page);
  });

  test("visual", async ({ page }) => {
    await page.clock.install();
    await toPix(page);
    await freezePixTimer(page);
    await expect(page.getByTestId("pix-timer")).toHaveText("30:00");
    await snap(page, "pix");
  });
});

test.describe("Pagamento que não segue", () => {
  test("pedido cancelado: o Pix avisa em vez de dizer que aguarda", async ({ page }) => {
    await toPix(page);
    await setOrderStatus(page, orderIdOf(page), "cancelado");
    const note = page.getByRole("status").filter({ hasText: "cancelado ou reembolsado" });
    await expect(note).toBeVisible({ timeout: 6000 });
    await expect(page.getByText("Aguardando pagamento…")).toHaveCount(0);
    await expect(note.getByRole("link", { name: /FALAR NO/ })).toBeVisible();
    await expect(note.getByRole("link", { name: "VOLTAR PARA A LOJA" })).toHaveAttribute(
      "href",
      "/loja",
    );
  });

  test("pedido cancelado: o boleto avisa", async ({ page }) => {
    await placeOrder(page, "boleto");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    await setOrderStatus(page, orderIdOf(page), "reembolsado");
    await expect(
      page.getByRole("status").filter({ hasText: "cancelado ou reembolsado" }),
    ).toBeVisible({ timeout: 6000 });
  });

  test("status 404: avisa e para de consultar", async ({ page }) => {
    let calls = 0;
    await toPix(page);
    await page.route("**/api/pedidos/*/status", (route) => {
      calls++;
      return route.fulfill({ status: 404 });
    });
    const note = page.getByRole("status").filter({ hasText: "Não encontramos mais este pedido" });
    await expect(note).toBeVisible({ timeout: 6000 });
    await expect(note.getByRole("link", { name: /FALAR NO/ })).toBeVisible();
    const seen = calls;
    await new Promise((resolve) => setTimeout(resolve, 7000)); // two missed polls
    expect(calls).toBe(seen);
  });

  test("falha de rede: avisa e continua tentando", async ({ page }) => {
    await toPix(page);
    await page.route("**/api/pedidos/*/status", (route) => route.abort());
    const note = page.getByRole("status").filter({ hasText: "Não conseguimos checar o pagamento" });
    await expect(note).toBeVisible({ timeout: 6000 });
    await page.unroute("**/api/pedidos/*/status");
    await expect(note).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByText("Aguardando pagamento…")).toBeVisible();
  });
});

test.describe("Boleto", () => {
  test("mostra JOGO PAUSADO, copia a linha digitável e o PDF fica desabilitado", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await placeOrder(page, "boleto");
    await expect(page).toHaveURL(/\/pedido\/[^/]+\/pagamento$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("JOGO");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    await expect(page.getByLabel("LINHA DIGITÁVEL")).toHaveValue("[linha digitável]");
    await page.getByRole("button", { name: "COPIAR", exact: true }).click();
    await expect(page.getByRole("button", { name: "COPIADO ✓" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("[linha digitável]");
    await expect(page.getByRole("button", { name: /BAIXAR BOLETO/ })).toBeDisabled();
    await expect(page.getByText("[00/00/0000]").first()).toBeVisible();
  });

  test("passa na acessibilidade", async ({ page }) => {
    await placeOrder(page, "boleto");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    await expectA11y(page);
  });

  test("visual", async ({ page }) => {
    await placeOrder(page, "boleto");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    await snap(page, "boleto");
  });

  test("quando o boleto é pago, vai para a confirmação", async ({ page }) => {
    await placeOrder(page, "boleto");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    const id = orderIdOf(page);
    await setOrderStatus(page, id, "pago");
    await expect(page).toHaveURL(new RegExp(`/pedido/${id}/confirmado$`), { timeout: 6000 });
  });
});

test.describe("Cartão", () => {
  test("recusado mostra CONTINUE? e PAGAR COM PIX abre o Pix do mesmo pedido", async ({ page }) => {
    await placeOrder(page, "cartao", "4000 0000 0000 0002");
    await expect(page).toHaveURL(/\/pedido\/[^/]+\/pagamento$/);
    await expect(page.getByRole("heading", { level: 1, name: "CONTINUE?" })).toBeVisible();
    const id = orderIdOf(page);
    expect(await storedLines(page)).toBe(1);
    await expect(page.getByRole("link", { name: "TENTAR DE NOVO" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    await expect(page.getByRole("link", { name: /FALAR NO DIRECT/ })).toBeVisible();
    await page.getByRole("button", { name: "PAGAR COM PIX" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /PAGUE COM PIX/ })).toBeVisible();
    expect(orderIdOf(page)).toBe(id);
    await expect(page.getByTestId("pix-timer")).toHaveText(TIMER);
    expect(await storedLines(page)).toBe(1);
  });

  test("aprovado vai direto para a confirmação", async ({ page }) => {
    await placeOrder(page, "cartao");
    await expect(page).toHaveURL(/\/pedido\/[^/]+\/confirmado$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CLEAR!");
    await expect.poll(() => storedLines(page)).toBe(0);
  });

  test("passa na acessibilidade", async ({ page }) => {
    await placeOrder(page, "cartao", "4000 0000 0000 0002");
    await expect(page.getByRole("heading", { level: 1, name: "CONTINUE?" })).toBeVisible();
    await expectA11y(page);
  });

  test("visual", async ({ page }) => {
    await page.clock.install();
    await placeOrder(page, "cartao", "4000 0000 0000 0002");
    await expect(page.getByRole("heading", { level: 1, name: "CONTINUE?" })).toBeVisible();
    // The countdown is decorative: run it to its end so the picture is always the same.
    await page.clock.runFor(10_000);
    await snap(page, "recusado");
  });
});

test.describe("Confirmação", () => {
  test("aparece o número do pedido, a barra de progresso e os botões", async ({ page }) => {
    await placeOrder(page, "cartao");
    await expect(page).toHaveURL(/\/pedido\/[^/]+\/confirmado$/);
    await expect(page.getByText("#0006").first()).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Progresso do pedido" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await expect(page.getByText(/foto da peça pronta por e-mail/)).toBeVisible();
    await expect(page.getByRole("link", { name: "JOGAR DE NOVO" })).toHaveAttribute("href", "/");
    await expectA11y(page);
  });

  test("com o pagamento pendente, volta para /pagamento", async ({ page }) => {
    await placeOrder(page, "boleto");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PAUSADO");
    const id = orderIdOf(page);
    await page.goto(`/pedido/${id}/confirmado`);
    await expect(page).toHaveURL(new RegExp(`/pedido/${id}/pagamento$`));
  });

  test("visual", async ({ page }) => {
    await placeOrder(page, "cartao");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("CLEAR!");
    await snap(page, "confirmado");
  });
});

test.describe("Posse do pedido", () => {
  test("outro navegador não vê o pedido nem o status", async ({ page, browser, baseURL }) => {
    await toPix(page);
    const id = orderIdOf(page);
    const other = await browser.newContext({ baseURL });
    try {
      const otherPage = await other.newPage();
      for (const path of [`/pedido/${id}/pagamento`, `/pedido/${id}/confirmado`]) {
        await otherPage.goto(path);
        await expect(otherPage.getByRole("heading", { level: 1 })).toHaveText(
          "FASE NÃO ENCONTRADA",
        );
        await expect(
          otherPage.locator('meta[name="robots"][content="noindex"]').first(),
        ).toBeAttached();
      }
      const status = await other.request.get(`/api/pedidos/${id}/status`);
      expect(status.status()).toBe(404);
      expect(await status.text()).not.toContain("aguardando");
    } finally {
      await other.close();
    }
  });

  test("o dono consulta o status pela rota", async ({ page }) => {
    await toPix(page);
    const res = await page.request.get(`/api/pedidos/${orderIdOf(page)}/status`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "aguardando_pagamento" });
  });

  test("pedido que não existe dá 404", async ({ page, request }) => {
    await page.goto("/pedido/ord_nao-existe/pagamento");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("FASE NÃO ENCONTRADA");
    expect((await request.get("/api/pedidos/ord_nao-existe/status")).status()).toBe(404);
  });

  test("a rota de teste só mexe em pedidos que existem", async ({ request }) => {
    const res = await request.post("/api/__mock__/pedidos/ord_nao-existe", {
      data: { status: "pago" },
    });
    expect(res.status()).toBe(404);
  });
});
