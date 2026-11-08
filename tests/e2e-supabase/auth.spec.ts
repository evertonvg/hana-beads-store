import type { BrowserContext, Page } from "@playwright/test";

import { expect, gotoHydrated, passwordField, signIn, test, uniqueEmail } from "./support/fixtures";
import { inboxSize, latestLink } from "./support/mailpit";

const NAME = "Nova Pessoa";
const PASSWORD = "Senha@123";
const LINK_ERROR = "Link inválido ou expirado. Peça um novo.";

/** Signs up `email` through /cadastro and waits for "CONFIRA SEU E-MAIL". */
async function signUp(page: Page, email: string) {
  await gotoHydrated(page, "/cadastro");
  await page.getByLabel("Nome completo").fill(NAME);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Celular").fill("11912345678");
  await passwordField(page).fill(PASSWORD);
  await page.getByLabel("Confirmar senha").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /Li e concordo/ }).click();
  await page.getByRole("button", { name: "CRIAR CONTA", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CONFIRA SEU E-MAIL" })).toBeVisible();
}

/** Signs up and opens the confirmation link from Mailpit: lands signed in on /conta. */
async function signUpConfirmed(page: Page, email: string): Promise<string> {
  await signUp(page, email);
  const link = await latestLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAME);
  return link;
}

/** SAIR from the /conta side menu (desktop): the session ends and the app goes home. */
async function signOut(page: Page) {
  await gotoHydrated(page, "/conta?aba=dados");
  await page.getByRole("button", { name: /^SAIR/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

const authCookies = async (context: BrowserContext) =>
  (await context.cookies()).filter((c) => c.name.startsWith("sb-"));

test("cadastro → CONFIRA SEU E-MAIL → link do Mailpit → /conta com o nome e as abas abrem", async ({
  page,
}) => {
  const email = uniqueEmail("cadastro");
  await signUp(page, email);
  await expect(page).toHaveURL(/\/cadastro\/confirme-seu-email\?email=/);
  const link = await latestLink(email);
  expect(link).toMatch(/^\/auth\/confirm\?next=%2Fconta&token_hash=[^&]+&type=email$/);

  await page.goto(link);
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAME);

  // The account bridge only reads: every tab must still render without an error.
  const tabs = [
    ["dados", "MEUS DADOS"],
    ["enderecos", "ENDEREÇOS"],
    ["privacidade", "PRIVACIDADE E DADOS"],
  ] as const;
  for (const [tab, title] of tabs) {
    const response = await page.goto(`/conta?aba=${tab}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAME);
  }
  await page.goto("/conta?aba=dados");
  await expect(page.getByLabel("Nome completo")).toHaveValue(NAME);
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(email);
});

test("sair → /entrar: sem 'manter conectado' os cookies sb-* são de sessão; com a opção, ~30 dias", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("lembrar");
  await signUpConfirmed(page, email);
  await signOut(page);
  expect(await authCookies(context)).toEqual([]);

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/conta$/);
  const session = await authCookies(context);
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) expect(cookie, cookie.name).toMatchObject({ expires: -1 });

  await signOut(page);
  await signIn(page, email, PASSWORD, { remember: true });
  await expect(page).toHaveURL(/\/conta$/);
  const remembered = await authCookies(context);
  expect(remembered.length).toBeGreaterThan(0);
  for (const cookie of remembered) {
    const days = (cookie.expires - Date.now() / 1000) / 86400;
    expect(days, cookie.name).toBeGreaterThan(29);
    expect(days, cookie.name).toBeLessThanOrEqual(30);
  }
});

test("recuperação de senha de ponta a ponta: pedir → e-mail → nova senha → a nova passa a valer", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("recuperar");
  await signUpConfirmed(page, email);
  await signOut(page);

  await gotoHydrated(page, "/entrar?modo=recuperar");
  await page.getByLabel("E-mail cadastrado").fill(email);
  await page.getByRole("button", { name: "ENVIAR LINK" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  const link = await latestLink(email, 2);
  expect(link).toMatch(/type=recovery/);

  await gotoHydrated(page, link);
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  await expect(page.getByRole("heading", { name: "CRIE SUA SENHA" })).toBeVisible();
  await page.getByLabel("Nova senha", { exact: true }).fill("Nova@1234");
  await page.getByLabel("Confirmar nova senha").fill("Nova@1234");
  await page.getByRole("button", { name: "SALVAR NOVA SENHA" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  await context.clearCookies();
  await signIn(page, email, PASSWORD);
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await signIn(page, email, "Nova@1234");
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NAME);
});

test("o link usado duas vezes cai em /entrar com o alerta de link inválido", async ({
  page,
  context,
}) => {
  const link = await signUpConfirmed(page, uniqueEmail("link"));
  await context.clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/entrar\?erro=link$/);
  await expect(page.getByRole("alert").filter({ hasText: "Link inválido" })).toHaveText(LINK_ERROR);
});

test("login de conta não confirmada pede a confirmação e REENVIAR LINK manda outro e-mail", async ({
  page,
}) => {
  const email = uniqueEmail("pendente");
  await signUp(page, email);
  await latestLink(email);
  const firstSentBy = Date.now();

  await signIn(page, email, PASSWORD);
  await expect(page.getByText("Confirme seu e-mail para entrar.")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
  // GoTrue sends one e-mail per user per second (config.toml max_frequency) and the app answers
  // the same either way, so give it that second before asking again.
  await expect.poll(() => Date.now() - firstSentBy).toBeGreaterThan(1_100);
  await page.getByRole("button", { name: "REENVIAR LINK" }).click();
  await expect(
    page.getByText("Se houver uma conta pendente, enviamos um novo link."),
  ).toBeVisible();
  await expect.poll(() => inboxSize(email), { timeout: 15_000 }).toBe(2);
});
