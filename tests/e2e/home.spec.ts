import { expect, expectA11y, snap, test } from "./support/fixtures";
import { expectTouchTargets } from "./support/touch-targets";
import type { Page } from "@playwright/test";

const ALTS = [
  "Chaveiro de personagem em pixel art com cabelo rosa",
  "Chaveiro de estrela vermelha com o número 13",
  "Chaveiro de estrela vermelha e rosa com a letra R",
];

test("hero tem o título do design e um único h1", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("1 PLAYER · FEITO À MÃO")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "PRESS START NO SEU NOVO CHAVEIRO",
  );
});

test("INSERT COIN leva para a loja", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "INSERT COIN ›" }).click();
  await expect(page).toHaveURL(/\/loja$/);
});

test("ENCOMENDAR leva para as encomendas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "ENCOMENDAR", exact: true })).toHaveAttribute(
    "href",
    "/encomendas",
  );
});

test("vitrine mostra 3 destaques com o alt do design e VER TODOS", async ({ page }) => {
  await page.goto("/");
  const vitrine = page.locator("#loja");
  await expect(vitrine.getByRole("heading", { name: /SELECIONE\s*SEU ITEM/ })).toBeVisible();
  await expect(vitrine.getByRole("article")).toHaveCount(3);
  for (const alt of ALTS) await expect(vitrine.getByRole("img", { name: alt })).toBeVisible();
  await expect(vitrine.getByRole("link", { name: "VER TODOS ›" })).toHaveAttribute("href", "/loja");
  await expect(vitrine.getByText("★★★ ÉPICO")).toBeVisible();
  await expect(vitrine.getByText("★★ RARO")).toHaveCount(2);
});

test("como funciona mostra as 3 fases", async ({ page }) => {
  await page.goto("/");
  const fases = page.locator("#fases");
  await expect(fases.getByRole("heading", { name: /^COMO FUNCIONA/ })).toBeVisible();
  for (const t of ["CHAMA NO DIRECT", "CONTA POR CONTA", "ITEM COLETADO!"]) {
    await expect(fases.getByRole("heading", { name: t })).toBeVisible();
  }
});

test("secao sobre existe com texto placeholder", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#sobre")).toContainText('[texto "Sobre"]');
});

test.describe("newsletter", () => {
  const posts = (page: Page) => {
    const sent: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") sent.push(r.url());
    });
    return sent;
  };

  test("consentimento comeca desmarcado e é obrigatório", async ({ page }) => {
    await page.goto("/");
    const sent = posts(page);
    const consent = page.getByRole("checkbox", { name: /novidades/i });
    await expect(consent).toHaveAttribute("aria-checked", "false");
    await page.getByLabel("Seu e-mail").fill("novidades@teste.dev");
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(page.getByText("Marque a caixa para continuar.")).toBeVisible();
    await expect(consent).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
  });

  test("e-mail invalido mostra erro no campo", async ({ page }) => {
    await page.goto("/");
    const sent = posts(page);
    const email = page.getByLabel("Seu e-mail");
    await email.fill("isso-nao-e-email");
    await page.getByRole("checkbox", { name: /novidades/i }).click();
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    expect(sent).toEqual([]);
  });

  test("e-mail repetido recebe a mesma confirmação neutra", async ({ page }) => {
    await page.goto("/");
    const mensagens: string[] = [];
    for (let i = 0; i < 2; i++) {
      await page.getByLabel("Seu e-mail").fill("repetido@teste.dev");
      await page.getByRole("checkbox", { name: /novidades/i }).click();
      await page.getByRole("button", { name: "YES!" }).click();
      await expect(page.getByRole("status")).toContainText("YES!");
      mensagens.push((await page.getByRole("status").textContent()) ?? "");
    }
    expect(mensagens[1]).toBe(mensagens[0]);
  });

  test("falha do servidor mostra erro e a pagina continua", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Seu e-mail").fill("falha@teste.dev");
    await page.getByRole("checkbox", { name: /novidades/i }).click();
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Não foi possível agora" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A later successful submit clears the previous error.
    await page.getByLabel("Seu e-mail").fill("ok@teste.dev");
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(page.getByRole("status")).toContainText("YES!");
  });

  test("e-mail valido com consentimento confirma", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Seu e-mail").fill(`novidades@teste.dev`);
    await page.getByRole("checkbox", { name: /novidades/i }).click();
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(page.getByRole("status")).toContainText("YES!");
  });
});

test("alvos de toque da home tem pelo menos 44px", async ({ page }) => {
  await page.goto("/");
  await expectTouchTargets(page.locator("main"));
});

test("home passa na checagem de acessibilidade", async ({ page }) => {
  await page.goto("/");
  await expectA11y(page);
  await snap(page, "home");
});
