import type { Page } from "@playwright/test";
import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";
import { expectTouchTargets } from "./support/touch-targets";

const KEY = "pp_cart_v1";

async function seedCart(page: Page) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({
      state: { lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }] },
      version: 1,
    }),
  ] as [string, string]);
}

async function openCheckout(page: Page) {
  await seedCart(page);
  await gotoHydrated(page, "/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "SAVE GAME" })).toBeVisible();
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: "SAVE GAME" });

async function fillGuest(page: Page, over: { cpf?: string } = {}) {
  await field(page, "Nome completo").fill("Nova Pessoa");
  await field(page, "E-mail").fill("nova@teste.dev");
  await field(page, "Celular").fill("11912345678");
  await field(page, "CPF").fill(over.cpf ?? "52998224725");
  await field(page, "CEP").fill("01001000");
  await expect(field(page, "Rua")).toHaveValue("Praça da Sé");
  await field(page, "Número").fill("100");
  await page.getByRole("radio", { name: /PAC/ }).click();
}

test("CEP 01001-000 preenche rua, bairro, cidade e UF", async ({ page }) => {
  await openCheckout(page);
  await field(page, "CEP").fill("01001000");
  await expect(field(page, "Rua")).toHaveValue("Praça da Sé");
  await expect(field(page, "Bairro")).toHaveValue("Sé");
  await expect(field(page, "Cidade")).toHaveValue("São Paulo");
  await expect(field(page, "UF")).toHaveValue("SP");
  await expect(page.getByRole("radio", { name: /PAC/ })).toBeVisible();
});

test("CPF inválido mostra erro no campo e foca nele", async ({ page }) => {
  await openCheckout(page);
  await fillGuest(page, { cpf: "11111111111" });
  await save(page).click();
  await expect(page.getByText("Informe um CPF válido.")).toBeVisible();
  await expect(field(page, "CPF")).toBeFocused();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("caminho feliz com Pix leva a /pedido/<id>/pagamento", async ({ page }) => {
  await openCheckout(page);
  await expect(page.getByRole("radio", { name: /PIX/ })).toBeChecked();
  await fillGuest(page);
  await save(page).click();
  await expect(page).toHaveURL(/\/pedido\/[^/]+\/pagamento$/);
  await expect(page.getByRole("heading", { level: 1, name: /PAGUE COM PIX/ })).toBeVisible();
  await expect(page.getByTestId("pix-timer")).toBeVisible();
});

test("duplo clique em SAVE GAME cria um único pedido", async ({ page, request }) => {
  await openCheckout(page);
  await fillGuest(page);
  await save(page).dblclick();
  await expect(page).toHaveURL(/\/pedido\/[^/]+\/pagamento$/);
  const res = await request.get("/api/__mock__/pedidos?count");
  expect(await res.json()).toEqual({ count: 1 });
});

test("logada como ana, os campos vêm preenchidos e o quadro Já tem conta? some", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/checkout");
  await expect(field(page, "Nome completo")).toHaveValue("Ana Souza");
  await expect(field(page, "E-mail")).toHaveValue("ana@teste.dev");
  await expect(field(page, "Celular")).toHaveValue("(11) 91234-5678");
  await expect(field(page, "CPF")).toHaveValue("529.982.247-25");
  await expect(field(page, "CEP")).toHaveValue("01001-000");
  await expect(field(page, "Rua")).toHaveValue("Praça da Sé");
  await expect(page.getByText("Já tem conta?")).toHaveCount(0);
});

test("visitante vê o quadro Já tem conta? com links que voltam ao checkout", async ({ page }) => {
  await openCheckout(page);
  await expect(page.getByText("Já tem conta?")).toBeVisible();
  await expect(
    page.locator("#checkout-form").getByRole("link", { name: "ENTRAR", exact: true }),
  ).toHaveAttribute("href", "/entrar?next=%2Fcheckout");
});

test("criar conta no checkout pede senha, recusa e-mail em uso e não depende de marcar nada", async ({
  page,
}) => {
  await openCheckout(page);
  const box = page.getByRole("checkbox", { name: /Salvar meus dados/ });
  await expect(box).not.toBeChecked();
  await expect(field(page, "Crie uma senha")).toHaveCount(0);
  await box.click();
  await fillGuest(page);
  await field(page, "E-mail").fill("ana@teste.dev");
  await field(page, "Crie uma senha").fill("Senha@123");
  await save(page).click();
  await expect(page.getByText("E-mail já cadastrado.")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("/checkout com carrinho vazio volta para /carrinho", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/carrinho$/);
});

test("cartão mostra número, nome, validade e CVV", async ({ page }) => {
  await openCheckout(page);
  await page.getByRole("radio", { name: /CARTÃO/ }).click();
  await expect(field(page, "Número do cartão")).toBeVisible();
  await expect(field(page, "Nome impresso no cartão")).toBeVisible();
  await expect(field(page, "Validade")).toBeVisible();
  await expect(field(page, "CVV")).toBeVisible();
  await page.getByRole("radio", { name: /BOLETO/ }).click();
  await expect(field(page, "Número do cartão")).toHaveCount(0);
});

test("passa na acessibilidade e tem alvos de toque grandes", async ({ page }) => {
  await openCheckout(page);
  await expectA11y(page);
  await expectTouchTargets(page.getByRole("main"));
});

test("visual", async ({ page }) => {
  await openCheckout(page);
  await expect(page.locator('[data-testid="checkout-total"]:visible').first()).toHaveText(
    "R$ [VALOR]",
  );
  await snap(page, "checkout");
});

test("cartão: número e CVV nunca são enviados ao servidor", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") bodies.push(r.postData() ?? "");
  });
  await openCheckout(page);
  await fillGuest(page);
  await page.getByRole("radio", { name: /CARTÃO/ }).click();
  await field(page, "Número do cartão").fill("4111111111111111");
  await field(page, "Nome impresso no cartão").fill("NOVA PESSOA");
  await field(page, "Validade").fill("1230");
  await field(page, "CVV").fill("7391");
  await save(page).click();
  // The mock gateway approves this card: straight to the confirmation.
  await expect(page).toHaveURL(/\/pedido\/[^/]+\/confirmado$/);
  const sent = bodies.join("\n");
  expect(sent).toContain("mock_tok_");
  expect(sent).not.toContain("4111");
  expect(sent).not.toContain("7391");
});

test("o checkout tem cabeçalho mínimo, sem navegação nem rodapé", async ({ page }) => {
  await openCheckout(page);
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByRole("banner").getByRole("link", { name: /PIXEL PERFECT/ }),
  ).toHaveAttribute("href", "/");
});

test.describe("sem consentimento salvo", () => {
  test.use({ consent: "unset" });

  test("o aviso de cookies aparece no checkout", async ({ page }) => {
    await openCheckout(page);
    await expect(page.getByRole("button", { name: "REJEITAR OPCIONAIS" })).toBeVisible();
  });
});
