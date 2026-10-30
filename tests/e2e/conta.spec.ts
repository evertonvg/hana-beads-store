import type { Page } from "@playwright/test";
import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";
import { orderIdOf, seedCart, setOrderStatus } from "./support/order";

type Tab = "dados" | "enderecos" | "pedidos" | "privacidade";

/** Signs in as a fixture user and opens one tab of /conta, hydrated. */
async function openTab(page: Page, tab: Tab, user: "ana" | "bruno" = "ana") {
  await login(page, user);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, `/conta?aba=${tab}`);
}

const status = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ });

test.describe("meus dados", () => {
  test("editar o nome salva, mostra a confirmação e persiste", async ({ page }) => {
    await openTab(page, "dados");
    await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("ana@teste.dev");
    await page.getByLabel("Nome completo").fill("Ana Maria Souza");
    await page.getByRole("button", { name: "SALVAR", exact: true }).click();
    await expect(status(page)).toHaveText("Dados salvos.");
    await page.reload();
    await expect(page.getByLabel("Nome completo")).toHaveValue("Ana Maria Souza");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ana Maria Souza");
  });

  test("CPF inválido mostra o erro e CPF vazio é aceito", async ({ page }) => {
    await openTab(page, "dados");
    await page.getByLabel("CPF").fill("11111111111");
    await page.getByRole("button", { name: "SALVAR", exact: true }).click();
    await expect(page.getByText("Informe um CPF válido.")).toBeVisible();
    await page.getByLabel("CPF").fill("");
    await page.getByRole("button", { name: "SALVAR", exact: true }).click();
    await expect(status(page)).toHaveText("Dados salvos.");
  });

  test("alterar a senha exige a senha atual e a nova passa a valer", async ({ page }) => {
    await openTab(page, "dados");
    await page.getByLabel("Senha atual").fill("Errada@123");
    await page.getByLabel("Nova senha", { exact: true }).fill("Outra@1234");
    await page.getByLabel("Confirmar nova senha").fill("Outra@1234");
    await page.getByRole("button", { name: "ALTERAR SENHA" }).click();
    await expect(page.getByText("Senha atual incorreta.")).toBeVisible();

    await page.getByLabel("Senha atual").fill("Senha@123");
    await page.getByRole("button", { name: "ALTERAR SENHA" }).click();
    await expect(status(page)).toHaveText("Senha alterada.");
    const res = await page.request.post("/api/__mock__/reset");
    expect(res.ok()).toBe(true);
  });

  test("DESCONECTAR e CONECTAR o Google alternam o estado", async ({ page }) => {
    await openTab(page, "dados");
    await expect(page.getByText("Conectada · ana@teste.dev")).toBeVisible();
    await page.getByRole("button", { name: "Desconectar Google" }).click();
    await expect(status(page)).toHaveText("Conta desconectada.");
    await expect(page.getByText("Não conectada").first()).toBeVisible();
    await page.getByRole("button", { name: "Conectar Google" }).click();
    await expect(page.getByText("Conectada · ana@teste.dev")).toBeVisible();
  });
});

test.describe("endereços", () => {
  test("adiciona com CEP, marca como principal, troca e exclui", async ({ page }) => {
    await openTab(page, "enderecos");
    await expect(page.getByText("PRINCIPAL", { exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "+ NOVO ENDEREÇO" }).click();
    await page.getByLabel("Apelido").fill("Trabalho");
    await page.getByLabel("CEP").fill("01001000");
    await expect(page.getByLabel("Rua")).toHaveValue("Praça da Sé");
    await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
    await page.getByLabel("Número").fill("200");
    await page.getByRole("checkbox", { name: "Usar como endereço principal" }).click();
    await page.getByRole("button", { name: "SALVAR ENDEREÇO" }).click();
    await expect(status(page)).toHaveText("Endereço salvo.");

    const work = page.getByRole("listitem").filter({ hasText: "Trabalho" });
    await expect(work.getByText("PRINCIPAL", { exact: true })).toBeVisible();
    await expect(page.getByText("PRINCIPAL", { exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Tornar principal o endereço Casa" }).click();
    const home = page.getByRole("listitem").filter({ hasText: "Casa" });
    await expect(home.getByText("PRINCIPAL", { exact: true })).toBeVisible();
    await expect(work.getByText("PRINCIPAL", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Remover endereço Trabalho" }).click();
    await expect(status(page)).toHaveText("Endereço removido.");
    await expect(page.getByRole("listitem").filter({ hasText: "Trabalho" })).toHaveCount(0);
    await expect(home.getByText("PRINCIPAL", { exact: true })).toBeVisible();
  });

  test("CEP e número são obrigatórios e editar mantém os dados", async ({ page }) => {
    await openTab(page, "enderecos");
    await page.getByRole("button", { name: "+ NOVO ENDEREÇO" }).click();
    await page.getByRole("button", { name: "SALVAR ENDEREÇO" }).click();
    await expect(page.getByText("Informe um CEP válido (8 números).")).toBeVisible();
    await expect(page.getByText("Informe o número.")).toBeVisible();
    await page.getByRole("button", { name: "CANCELAR" }).click();

    await page.getByRole("button", { name: "Editar endereço Casa" }).click();
    await expect(page.getByLabel("Rua")).toHaveValue("Praça da Sé");
    await page.getByLabel("Número").fill("101");
    await page.getByRole("button", { name: "SALVAR ENDEREÇO" }).click();
    await expect(page.getByText("Praça da Sé, 101")).toBeVisible();
  });
});

test.describe("pedidos", () => {
  test("sem pedidos mostra o aviso e o link para a lista completa", async ({ page }) => {
    await openTab(page, "pedidos", "bruno");
    await expect(page.getByText("Você ainda não fez pedidos.")).toBeVisible();
    await expect(page.getByRole("link", { name: "VER TODOS ›" })).toHaveAttribute(
      "href",
      "/conta/pedidos",
    );
  });

  test("mostra os pedidos da conta com o status", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await seedCart(page);
    await gotoHydrated(page, "/checkout");
    await page.getByRole("radio", { name: /PAC/ }).click();
    await page.getByRole("button", { name: "SAVE GAME" }).click();
    await page.waitForURL(/\/pedido\//);
    await setOrderStatus(page, orderIdOf(page), "em_producao");

    await gotoHydrated(page, "/conta?aba=pedidos");
    // Ana's five fixture orders come first, so the new one is #0006; the preview shows the newest two.
    const created = page.getByRole("listitem").filter({ hasText: "PEDIDO #0006" });
    await expect(created).toBeVisible();
    await expect(created.getByText("EM PRODUÇÃO")).toBeVisible();
    await expect(page.getByText("PEDIDO #0005")).toBeVisible();
    await expect(created.getByRole("link", { name: /Ver detalhes/ })).toHaveAttribute(
      "href",
      "/conta/pedidos",
    );
  });
});

test.describe("privacidade e dados", () => {
  test("o switch de novidades alterna e persiste depois de recarregar", async ({ page }) => {
    await openTab(page, "privacidade");
    const sw = page.getByRole("switch", { name: "Novidades por e-mail" });
    await expect(sw).not.toBeChecked();
    await sw.click();
    await expect(status(page)).toHaveText("Você vai receber novidades.");
    await page.reload();
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(status(page)).toHaveText("Novidades desligadas.");
    await page.reload();
    await expect(sw).not.toBeChecked();
  });

  test("BAIXAR MEUS DADOS baixa só os dados da própria conta", async ({ page }) => {
    await openTab(page, "privacidade");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "BAIXAR MEUS DADOS" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("pixel-perfect-meus-dados.json");
    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path, "utf8");
    const data = JSON.parse(text) as { profile: { email: string } };
    expect(data.profile.email).toBe("ana@teste.dev");
    expect(text).not.toContain("bruno");
    expect(text).not.toContain("98765-4321");
    expect(text).not.toContain("Senha@123");
  });

  test("a exportação responde 401 sem sessão e vem com no-store", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const anonymous = await playwright.request.newContext({ baseURL: baseURL ?? "" });
    const denied = await anonymous.get("/api/conta/exportar");
    expect(denied.status()).toBe(401);
    expect(denied.headers()["cache-control"]).toBe("no-store");
    await anonymous.dispose();

    await openTab(page, "privacidade");
    const ok = await page.request.get("/api/conta/exportar");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("no-store");
    expect(ok.headers()["content-disposition"]).toBe(
      'attachment; filename="pixel-perfect-meus-dados.json"',
    );
  });

  test("a exportação do bruno não traz nada da ana", async ({ page }) => {
    await openTab(page, "privacidade", "bruno");
    const text = await (await page.request.get("/api/conta/exportar")).text();
    expect(JSON.parse(text)).toMatchObject({ profile: { email: "bruno@teste.dev" } });
    expect(text).not.toContain("ana");
    expect(text).not.toContain("Praça da Sé");
  });

  test("GERENCIAR COOKIES abre as preferências", async ({ page }) => {
    await openTab(page, "privacidade");
    await expect(page.getByText("[e-mail do encarregado]")).toBeVisible();
    await page.getByRole("button", { name: "GERENCIAR COOKIES" }).click();
    await expect(page.getByRole("dialog", { name: "PREFERÊNCIAS DE COOKIES" })).toBeVisible();
  });

  test("excluir com a senha errada mostra o erro e mantém a conta", async ({ page }) => {
    await openTab(page, "privacidade");
    await page.getByRole("button", { name: "EXCLUIR CONTA" }).click();
    await expect(page.getByText("GAME OVER DE VERDADE?")).toBeVisible();
    await page.getByLabel("Digite sua senha para confirmar").fill("Errada@123");
    await page.getByRole("button", { name: "SIM, EXCLUIR" }).click();
    await expect(page.getByText("Senha incorreta.")).toBeVisible();
    await expect(page).toHaveURL(/\/conta\?aba=privacidade$/);
    await page.getByRole("button", { name: "CANCELAR" }).click();
    await expect(page.getByLabel("Digite sua senha para confirmar")).toHaveCount(0);
  });

  test("excluir com a senha certa sai, avisa e a conta deixa de existir", async ({ page }) => {
    await openTab(page, "privacidade");
    await page.getByRole("button", { name: "EXCLUIR CONTA" }).click();
    await page.getByLabel("Digite sua senha para confirmar").fill("Senha@123");
    await page.getByRole("button", { name: "SIM, EXCLUIR" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Conta excluída. Seus dados foram apagados.")).toBeVisible();

    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta$/);
    await login(page);
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});

test.describe("sessão", () => {
  test("/conta deslogado vai para o login e volta para a aba pedida", async ({ page }) => {
    await page.goto("/conta?aba=privacidade");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta%3Faba%3Dprivacidade$/);
  });

  test("um cookie válido de uma conta já excluída conta como deslogado", async ({
    page,
    browser,
    baseURL,
  }) => {
    // Context A: signed in, with the profile form already open.
    await openTab(page, "dados");
    await page.getByLabel("Nome completo").fill("Ana Maria Souza");

    // Context B (another browser): the same user deletes the account. A's cookie stays sealed.
    const other = await browser.newContext({ baseURL: baseURL ?? "http://localhost:3100" });
    try {
      const second = await other.newPage();
      await login(second);
      await expect(second).toHaveURL(/\/conta$/);
      await gotoHydrated(second, "/conta?aba=privacidade");
      await second.getByRole("button", { name: "EXCLUIR CONTA" }).click();
      await second.getByLabel("Digite sua senha para confirmar").fill("Senha@123");
      await second.getByRole("button", { name: "SIM, EXCLUIR" }).click();
      await expect(second).toHaveURL(/\/$/);
    } finally {
      await other.close();
    }

    // A server action of the stale session answers "session expired" and saves nothing.
    await page.getByRole("button", { name: "SALVAR", exact: true }).click();
    await expect(page.getByText("Sua sessão expirou. Entre de novo.")).toBeVisible();

    // The export refuses it, uncached.
    const exported = await page.request.get("/api/conta/exportar");
    expect(exported.status()).toBe(401);
    expect(exported.headers()["cache-control"]).toBe("no-store");

    // The page treats it as signed out.
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta$/);
    await page.goto("/conta?aba=privacidade");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta%3Faba%3Dprivacidade$/);
  });

  test("acessibilidade de cada aba", async ({ page }) => {
    for (const tab of ["dados", "enderecos", "pedidos", "privacidade"] as const) {
      await openTab(page, tab);
      await expectA11y(page);
    }
  });

  test("visual: meus dados e privacidade", async ({ page }) => {
    await openTab(page, "dados");
    await expect(page.getByRole("heading", { name: "MEUS DADOS" })).toBeVisible();
    await snap(page, "conta-dados");
    await gotoHydrated(page, "/conta?aba=privacidade");
    await expect(page.getByRole("heading", { name: "PRIVACIDADE E DADOS" })).toBeVisible();
    await snap(page, "conta-privacidade");
  });
});
