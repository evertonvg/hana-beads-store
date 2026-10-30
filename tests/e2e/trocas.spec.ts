import path from "node:path";
import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

const WEBP = path.join(import.meta.dirname, "fixtures", "foto-peca.webp");

test("deslogado lê a política e vê o convite para entrar", async ({ page }) => {
  await page.goto("/trocas?pedido=ord_0002");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("TROCAS E DEVOLUÇÕES");
  await expect(
    main.getByRole("heading", { level: 2, name: /DIREITO DE ARREPENDIMENTO/ }),
  ).toBeVisible();
  await expect(main.getByText("7 DIAS", { exact: true })).toBeVisible();
  await expect(main.getByText("90 DIAS", { exact: true })).toBeVisible();
  await expect(main.getByText("ENTRE PARA SOLICITAR")).toBeVisible();
  const enter = main.getByRole("link", { name: "ENTRAR" });
  await expect(enter).toHaveAttribute("href", "/entrar?next=%2Ftrocas%3Fpedido%3Dord_0002");
  await expect(main.getByRole("button", { name: "ENVIAR SOLICITAÇÃO" })).toHaveCount(0);
  await expectA11y(page);
  await snap(page, "trocas-deslogado");
});

test("ana envia uma solicitação do pedido #0002 e recebe o protocolo T-0001", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/trocas?pedido=ord_0002");
  await expect(page.getByLabel("Pedido")).toHaveValue("ord_0002");

  await page.getByRole("radio", { name: "Chegou com defeito" }).click();
  await page.getByLabel("Conte o que aconteceu").fill("A argola quebrou na primeira semana.");
  await page.locator('input[type="file"]').setInputFiles(WEBP);
  await expect(page.getByRole("button", { name: /Remover foto foto-peca\.webp/ })).toBeVisible();
  await page.getByRole("radio", { name: "REEMBOLSO" }).click();
  await expectA11y(page);
  await snap(page, "trocas");

  await page.getByRole("button", { name: "ENVIAR SOLICITAÇÃO" }).click();
  await expect(page.getByRole("heading", { name: "SOLICITAÇÃO ENVIADA" })).toBeVisible();
  await expect(page.getByText("#T-0001")).toBeVisible();
  await expectA11y(page);
  await snap(page, "trocas-enviado");

  await page.getByRole("button", { name: "NOVA SOLICITAÇÃO" }).click();
  await expect(page.getByRole("button", { name: "ENVIAR SOLICITAÇÃO" })).toBeVisible();
  await expect(page.getByLabel("Conte o que aconteceu")).toHaveValue("");
});

test("pedido de outra pessoa não é pré-selecionado", async ({ page }) => {
  await login(page, "bruno");
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto("/trocas?pedido=ord_0002");
  await expect(page.getByText(/ainda não tem pedidos enviados ou entregues/)).toBeVisible();
  await expect(page.getByLabel("Pedido")).toHaveCount(0);
});

test("foto GIF é recusada com erro no campo e pode ser removida a foto válida", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/trocas");
  await expect(page.getByLabel("Pedido")).toHaveValue("");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "animacao.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(page.getByText("animacao.gif: use fotos JPG, PNG ou WebP.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Fotos escolhidas" })).toHaveCount(0);

  await input.setInputFiles(WEBP);
  await page.getByRole("button", { name: /Remover foto foto-peca\.webp/ }).click();
  await expect(page.getByRole("list", { name: "Fotos escolhidas" })).toHaveCount(0);
});

test("validação do formulário e arrependimento fora do prazo", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/conta$/);
  await gotoHydrated(page, "/trocas?pedido=ord_0002");
  await page.getByLabel("Conte o que aconteceu").fill("curta");
  await page.getByRole("button", { name: "ENVIAR SOLICITAÇÃO" }).click();
  await expect(page.getByText("Conte um pouco mais (mínimo de 10 caracteres).")).toBeVisible();

  await page.getByRole("radio", { name: "Desisti da compra (até 7 dias)" }).click();
  await page.getByLabel("Conte o que aconteceu").fill("Desisti, não era o que eu queria.");
  await page.getByRole("button", { name: "ENVIAR SOLICITAÇÃO" }).click();
  await expect(page.getByText(/Passou do prazo de 7 dias.*CDC art\. 49/).first()).toBeVisible();
});
