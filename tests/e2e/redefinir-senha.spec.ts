import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectA11y, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";
import { expectTouchTargets } from "./support/touch-targets";

type MailMessage = { to: string; kind: string; link: string };

async function lastLink(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.get(`/api/__mock__/inbox?email=${encodeURIComponent(email)}`);
  const inbox = (await res.json()) as MailMessage[];
  const link = inbox.at(-1)?.link;
  expect(link).toBeTruthy();
  return link as string;
}

/** Asks for the recovery e-mail of Ana through the form and returns its link. */
async function requestRecovery(page: Page, request: APIRequestContext): Promise<string> {
  await gotoHydrated(page, "/entrar?modo=recuperar");
  await page.getByLabel("E-mail cadastrado").fill("ana@teste.dev");
  await page.getByRole("button", { name: "ENVIAR LINK" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  const link = await lastLink(request, "ana@teste.dev");
  expect(link).toMatch(/^\/auth\/confirm\?token_hash=[^&]+&type=recovery&next=%2Fredefinir-senha$/);
  return link;
}

const newPassword = (page: Page) => page.getByLabel("Nova senha", { exact: true });
const confirmPassword = (page: Page) => page.getByLabel("Confirmar nova senha");
const save = (page: Page) => page.getByRole("button", { name: "SALVAR NOVA SENHA" });

/** Opens the e-mail link and waits for the new-password form to be interactive. */
async function openLink(page: Page, link: string) {
  await gotoHydrated(page, link);
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await expect(page.getByRole("heading", { name: "CRIE SUA SENHA" })).toBeVisible();
}

test("recuperação: pedir → e-mail → nova senha → /conta, e a nova senha passa a valer", async ({
  page,
  request,
  context,
}) => {
  await openLink(page, await requestRecovery(page, request));
  await expect(newPassword(page)).toBeFocused();
  await newPassword(page).fill("Nova@1234");
  await confirmPassword(page).fill("Nova@1234");
  await save(page).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  await context.clearCookies({ name: "pp_session" });
  await gotoHydrated(page, "/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@teste.dev");
  await page.getByLabel("Senha", { exact: true }).fill("Nova@1234");
  await page.getByRole("button", { name: "ENTRAR", exact: true }).click();
  await expect(page).toHaveURL(/\/conta$/);
});

test("senha fraca ou confirmação diferente não salvam", async ({ page, request }) => {
  await openLink(page, await requestRecovery(page, request));
  const unmet = page.locator('[aria-label="Regras da senha"] [data-met="false"]');
  await expect(unmet).toHaveCount(4);
  await newPassword(page).fill("abcdefgh");
  await expect(unmet).toHaveText([/1 maiúscula/, /1 número/, /1 símbolo/]);
  await confirmPassword(page).fill("abcdefgh");
  await save(page).click();
  await expect(page.getByText("A senha precisa cumprir todas as regras.")).toBeVisible();
  await newPassword(page).fill("Nova@1234");
  await confirmPassword(page).fill("Outra@1234");
  await save(page).click();
  await expect(page.getByText("As senhas não conferem.")).toBeVisible();
  await expect(page).toHaveURL(/\/redefinir-senha$/);
});

test("sem sessão, /redefinir-senha volta para pedir um link", async ({ page }) => {
  await page.goto("/redefinir-senha");
  await expect(page).toHaveURL(/\/entrar\?modo=recuperar$/);
});

test("o link usado de novo cai em /entrar com o aviso de link inválido", async ({
  page,
  request,
  context,
}) => {
  const link = await requestRecovery(page, request);
  await openLink(page, link);
  await context.clearCookies({ name: "pp_session" });
  await page.goto(link);
  await expect(page).toHaveURL(/\/entrar\?erro=link$/);
  await expect(page.getByRole("alert").filter({ hasText: "Link inválido" })).toHaveText(
    "Link inválido ou expirado. Peça um novo.",
  );
});

test("a tela passa na acessibilidade e nos alvos de toque", async ({ page, request }) => {
  await openLink(page, await requestRecovery(page, request));
  await expectA11y(page);
  await expectTouchTargets(page.getByRole("main"));
  await snap(page, "redefinir-senha");
});

test("o aviso de link inválido passa na acessibilidade", async ({ page }) => {
  await gotoHydrated(page, "/entrar?erro=link");
  await expect(page.getByText("Link inválido ou expirado. Peça um novo.")).toBeVisible();
  await expectA11y(page);
  await snap(page, "entrar-erro-link");
});
