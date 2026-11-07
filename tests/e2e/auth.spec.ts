import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectA11y, login, snap, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";
import { expectTouchTargets } from "./support/touch-targets";

const CART_KEY = "pp_cart_v1";

const password = (page: Page) => page.getByLabel("Senha", { exact: true });
const submitLogin = (page: Page) => page.getByRole("button", { name: "ENTRAR", exact: true });
const submitSignup = (page: Page) => page.getByRole("button", { name: "CRIAR CONTA", exact: true });

function cartLink(page: Page, isMobile: boolean, n: number) {
  const name = isMobile ? `Carrinho, ${n} ${n === 1 ? "item" : "itens"}` : `CARRINHO [${n}]`;
  return page.getByRole("link", { name });
}

async function expectSignedInHeader(page: Page, isMobile: boolean) {
  if (isMobile) {
    const menu = page.getByRole("button", { name: "Abrir menu" });
    // The 404 page is prerendered: wait for React to attach before clicking.
    await expect
      .poll(() => menu.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps"))))
      .toBe(true);
    await menu.click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "MINHA CONTA" })).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "MINHA CONTA" })).toBeVisible();
  }
}

async function fillSignup(
  page: Page,
  over: { email?: string; password?: string; confirm?: string } = {},
) {
  await page.getByLabel("Nome completo").fill("Nova Pessoa");
  await page.getByLabel("E-mail", { exact: true }).fill(over.email ?? "nova@teste.dev");
  await page.getByLabel("Celular").fill("11912345678");
  await password(page).fill(over.password ?? "Senha@123");
  await page.getByLabel("Confirmar senha").fill(over.confirm ?? over.password ?? "Senha@123");
}

const terms = (page: Page) => page.getByRole("checkbox", { name: /Li e concordo/ });

type MailMessage = { to: string; kind: string; link: string };

async function inboxOf(request: APIRequestContext, email: string): Promise<MailMessage[]> {
  const res = await request.get(`/api/__mock__/inbox?email=${encodeURIComponent(email)}`);
  return (await res.json()) as MailMessage[];
}

/** Signs up nova@teste.dev through the form and waits for "CONFIRA SEU E-MAIL". */
async function signUpNova(page: Page, email = "nova@teste.dev") {
  await gotoHydrated(page, "/cadastro");
  await fillSignup(page, { email });
  await terms(page).click();
  await submitSignup(page).click();
  await expect(page.getByRole("heading", { name: "CONFIRA SEU E-MAIL" })).toBeVisible();
}
const marketing = (page: Page) => page.getByRole("checkbox", { name: /novidades e lançamentos/ });

test.describe("entrar", () => {
  test("login da ana leva a /conta e o cabeçalho mostra MINHA CONTA", async ({
    page,
    isMobile,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expectSignedInHeader(page, isMobile);
  });

  test("senha errada mostra mensagem genérica e foca a senha", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill("ana@teste.dev");
    await password(page).fill("Errada@123");
    await submitLogin(page).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(password(page)).toBeFocused();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("e-mail desconhecido recebe a mesma mensagem", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill("ninguem@teste.dev");
    await password(page).fill("Senha@123");
    await submitLogin(page).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("campos vazios mostram os erros do formulário sem ir ao servidor", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await submitLogin(page).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
  });

  test("MOSTRAR troca o tipo da senha para text e OCULTAR volta", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expect(password(page)).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "MOSTRAR" }).click();
    await expect(password(page)).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "OCULTAR" }).click();
    await expect(password(page)).toHaveAttribute("type", "password");
  });

  test("/conta deslogado vai para /entrar?next=%2Fconta", async ({ page }) => {
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta$/);
  });

  test("um selo adulterado no cookie conta como deslogado", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "pp_session", value: "Fe26.2**adulterado", url: baseURL! }]);
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta$/);
  });

  test("o login volta para o next relativo e o cabeçalho atualiza sem recarregar", async ({
    page,
    isMobile,
  }) => {
    await gotoHydrated(page, "/entrar?next=%2Floja");
    await page.getByLabel("E-mail", { exact: true }).fill("ana@teste.dev");
    await password(page).fill("Senha@123");
    await submitLogin(page).click();
    await expect(page).toHaveURL(/\/loja$/);
    await expectSignedInHeader(page, isMobile);
  });

  // The callback route (which creates the session and follows `next`) lands in a later task:
  // until then these check that the button leaves for the provider URL with the safe next.
  test("o login social vai para a URL do provedor levando o next", async ({ page }) => {
    await gotoHydrated(page, "/entrar?next=%2Floja");
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await expect(page).toHaveURL(/\/auth\/callback\?code=mock-google&next=%2Floja$/);
  });

  for (const evil of ["//evil.com", "/\\evil.com", "https://evil.com", "/%2F%2Fevil.com"]) {
    test(`next=${evil} é ignorado e vai para /conta`, async ({ page }) => {
      await gotoHydrated(page, `/entrar?next=${encodeURIComponent(evil)}`);
      await page.getByLabel("E-mail", { exact: true }).fill("ana@teste.dev");
      await password(page).fill("Senha@123");
      await submitLogin(page).click();
      await expect(page).toHaveURL(/\/conta$/);
    });
  }

  test("o cookie de sessão é httpOnly, lax e dura só a sessão sem 'manter conectado'", async ({
    page,
    context,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    const cookie = (await context.cookies()).find((c) => c.name === "pp_session");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", expires: -1 });
  });

  test("'manter conectado' deixa o cookie por cerca de 30 dias", async ({ page, context }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill("ana@teste.dev");
    await password(page).fill("Senha@123");
    await page.getByRole("checkbox", { name: "Manter conectado" }).click();
    await submitLogin(page).click();
    await expect(page).toHaveURL(/\/conta$/);
    const cookie = (await context.cookies()).find((c) => c.name === "pp_session");
    const days = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86400;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  test("login social sem next vai para o provedor com next=/conta", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByRole("button", { name: "Continuar com Facebook" }).click();
    await expect(page).toHaveURL(/\/auth\/callback\?code=mock-facebook&next=%2Fconta$/);
  });

  test("conta não confirmada pede a confirmação e oferece REENVIAR LINK", async ({
    page,
    request,
  }) => {
    await signUpNova(page);
    await gotoHydrated(page, "/entrar");
    await page.getByLabel("E-mail", { exact: true }).fill("nova@teste.dev");
    await password(page).fill("Senha@123");
    await submitLogin(page).click();
    await expect(page.getByText("Confirme seu e-mail para entrar.")).toBeVisible();
    await page.getByRole("button", { name: "REENVIAR LINK" }).click();
    await expect(
      page.getByText("Se houver uma conta pendente, enviamos um novo link."),
    ).toBeVisible();
    expect(await inboxOf(request, "nova@teste.dev")).toHaveLength(2);
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("Apple não aparece enquanto está desligado", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar com Facebook" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar com Apple" })).toHaveCount(0);
  });

  test("carrinho de visitante + carrinho salvo da ana = CARRINHO [2]", async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(
      // Only seeds once: the page may reload on navigation and must keep what the app saved.
      ([key, value]) => localStorage.getItem(key) ?? localStorage.setItem(key, value),
      [
        CART_KEY,
        JSON.stringify({
          state: { lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }] },
          version: 1,
        }),
      ] as [string, string],
    );
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
    const stored = await page.evaluate((key) => localStorage.getItem(key), CART_KEY);
    const parsed = JSON.parse(stored ?? "{}") as { state: { lines: { productId: string }[] } };
    const ids = parsed.state.lines.map((l) => l.productId);
    expect(ids.sort()).toEqual(["e13", "garota"]);
  });

  test("entrar de novo com o mesmo usuário não dobra o carrinho", async ({
    page,
    context,
    isMobile,
  }) => {
    await page.addInitScript(
      ([key, value]) => localStorage.getItem(key) ?? localStorage.setItem(key, value),
      [
        CART_KEY,
        JSON.stringify({
          state: { lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }] },
          version: 1,
        }),
      ] as [string, string],
    );
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
    await context.clearCookies({ name: "pp_session" });
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
    const stored = await page.evaluate((key) => localStorage.getItem(key), CART_KEY);
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ state: { owner: "ana" } });
  });

  test("item adicionado logado fica salvo: sessão perdida, storage limpo, novo login traz tudo sem dobrar", async ({
    page,
    context,
    isMobile,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expect(cartLink(page, isMobile, 1)).toBeVisible();
    await gotoHydrated(page, "/produto/garota-pixel");
    await page.getByRole("button", { name: "+ PEGAR ITEM" }).click();
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
    // The save is debounced (600 ms) and other actions (cart pricing) also post the lines, so there
    // is no single request to wait for: let the timer and the action finish.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- fixed debounce window
    await page.waitForTimeout(2000);
    await context.clearCookies({ name: "pp_session" });
    await page.evaluate(() => localStorage.clear());
    await login(page);
    await expect(page).toHaveURL(/\/conta$/);
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
    await context.clearCookies({ name: "pp_session" });
    await login(page);
    await expect(cartLink(page, isMobile, 2)).toBeVisible();
  });

  test("passa na acessibilidade e nos alvos de toque", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await expectA11y(page);
    await expectTouchTargets(page.getByRole("main"));
    await snap(page, "entrar");
  });
});

test.describe("recuperar senha", () => {
  test("e-mail inexistente mostra Confira seu e-mail", async ({ page }) => {
    await gotoHydrated(page, "/entrar");
    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await page.getByLabel("E-mail cadastrado").fill("ninguem@teste.dev");
    await page.getByRole("button", { name: "ENVIAR LINK" }).click();
    await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
    await expect(page.getByText("Se o e-mail estiver cadastrado")).toBeVisible();
  });

  test("e-mail existente mostra exatamente a mesma tela", async ({ page }) => {
    const bodyFor = async (email: string) => {
      await gotoHydrated(page, "/entrar?modo=recuperar");
      await page.getByLabel("E-mail cadastrado").fill(email);
      await page.getByRole("button", { name: "ENVIAR LINK" }).click();
      await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
      return page.getByRole("main").innerText();
    };
    expect(await bodyFor("ana@teste.dev")).toBe(await bodyFor("ninguem@teste.dev"));
  });

  test("?modo=recuperar abre direto no estado, foca o e-mail e dá para voltar", async ({
    page,
  }) => {
    await gotoHydrated(page, "/entrar?modo=recuperar");
    await expect(page.getByRole("heading", { name: "ESQUECEU A SENHA?" })).toBeVisible();
    await expect(page.getByLabel("E-mail cadastrado")).toBeFocused();
    await page.getByRole("button", { name: /Voltar para o login/ }).click();
    await expect(page.getByRole("heading", { name: "PLAYER LOGIN" })).toBeVisible();
  });

  test("e-mail malformado mostra erro de campo", async ({ page }) => {
    await gotoHydrated(page, "/entrar?modo=recuperar");
    await page.getByLabel("E-mail cadastrado").fill("x");
    await page.getByRole("button", { name: "ENVIAR LINK" }).click();
    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  });

  test("/recuperar-senha redireciona para o modo recuperar", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page).toHaveURL(/\/entrar\?modo=recuperar$/);
  });

  test("passa na acessibilidade e tem o visual do estado enviado", async ({ page }) => {
    await gotoHydrated(page, "/entrar?modo=recuperar");
    await expectA11y(page);
    await page.getByLabel("E-mail cadastrado").fill("ninguem@teste.dev");
    await page.getByRole("button", { name: "ENVIAR LINK" }).click();
    await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
    await expectA11y(page);
    await snap(page, "recuperar-enviado");
  });
});

test.describe("cadastro", () => {
  test("CRIAR CONTA fica desabilitado até aceitar os termos; novidades vem desmarcado", async ({
    page,
  }) => {
    await gotoHydrated(page, "/cadastro");
    await expect(submitSignup(page)).toBeDisabled();
    await expect(terms(page)).not.toBeChecked();
    await expect(marketing(page)).not.toBeChecked();
    await terms(page).click();
    await expect(submitSignup(page)).toBeEnabled();
    await terms(page).click();
    await expect(submitSignup(page)).toBeDisabled();
  });

  test("senha fraca mostra as regras não cumpridas e bloqueia o envio", async ({ page }) => {
    await gotoHydrated(page, "/cadastro");
    const unmet = page.locator('[aria-label="Regras da senha"] [data-met="false"]');
    await expect(unmet).toHaveCount(4);
    await fillSignup(page, { password: "abcdefgh" });
    await expect(unmet).toHaveText([/1 maiúscula/, /1 número/, /1 símbolo/]);
    await terms(page).click();
    await submitSignup(page).click();
    await expect(page.getByText("A senha precisa cumprir todas as regras.")).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
    await password(page).fill("Senha@123");
    await expect(unmet).toHaveCount(0);
  });

  test("confirmação diferente da senha mostra erro e bloqueia o envio", async ({ page }) => {
    await gotoHydrated(page, "/cadastro");
    await fillSignup(page, { confirm: "Outra@1234" });
    await terms(page).click();
    await submitSignup(page).click();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
  });

  test("e-mail da ana mostra a mesma tela de confirmação, sem enviar nada", async ({
    page,
    request,
  }) => {
    await signUpNova(page, "ana@teste.dev");
    await expect(page).toHaveURL(/\/cadastro\/confirme-seu-email\?email=ana%40teste\.dev$/);
    await expect(page.getByText("Enviamos um link para a***@teste.dev.")).toBeVisible();
    expect(await inboxOf(request, "ana@teste.dev")).toEqual([]);
  });

  // Opening the link (/auth/confirm creates the session) lands with the confirm route in a later
  // task; here the flow stops at the e-mail the mock "sent".
  test("sucesso abre CONFIRA SEU E-MAIL, sem sessão, e o link chega na caixa", async ({
    page,
    context,
    request,
  }) => {
    await signUpNova(page);
    await expect(page).toHaveURL(/\/cadastro\/confirme-seu-email\?email=nova%40teste\.dev$/);
    await expect(page.getByText("Enviamos um link para n***@teste.dev.")).toBeVisible();
    await expect(page.getByText("nova@teste.dev")).toHaveCount(0);
    expect((await context.cookies()).some((c) => c.name === "pp_session")).toBe(false);
    const inbox = await inboxOf(request, "nova@teste.dev");
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ to: "nova@teste.dev", kind: "confirmacao" });
    expect(inbox[0]?.link).toMatch(/^\/auth\/confirm\?token_hash=[^&]+&type=email&next=%2Fconta$/);
  });

  test("REENVIAR LINK manda um novo link e responde sem revelar a conta", async ({
    page,
    request,
  }) => {
    await signUpNova(page);
    await page.getByRole("button", { name: "REENVIAR LINK" }).click();
    await expect(
      page.getByText("Se houver uma conta pendente, enviamos um novo link."),
    ).toBeVisible();
    expect(await inboxOf(request, "nova@teste.dev")).toHaveLength(2);
    await page.getByRole("link", { name: /VOLTAR PARA ENTRAR/ }).click();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("sem e-mail válido na URL, a tela de confirmação volta ao cadastro", async ({ page }) => {
    await page.goto("/cadastro/confirme-seu-email?email=x");
    await expect(page).toHaveURL(/\/cadastro$/);
  });

  test("a tela de confirmação passa na acessibilidade e nos alvos de toque", async ({ page }) => {
    await signUpNova(page);
    await expectA11y(page);
    await expectTouchTargets(page.getByRole("main"));
    await snap(page, "confirme-seu-email");
  });

  test("passa na acessibilidade e nos alvos de toque", async ({ page }) => {
    await gotoHydrated(page, "/cadastro");
    await expectA11y(page);
    await expectTouchTargets(page.getByRole("main"));
    await snap(page, "cadastro");
  });
});
