import { expect, test } from "./support/fixtures";
import { gotoHydrated } from "./support/hydration";

test("campos da nova senha têm pelo menos 16px (sem zoom do iOS)", async ({ page, request }) => {
  await gotoHydrated(page, "/entrar?modo=recuperar");
  await page.getByLabel("E-mail cadastrado").fill("ana@teste.dev");
  await page.getByRole("button", { name: "ENVIAR LINK" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  const res = await request.get("/api/__mock__/inbox?email=ana%40teste.dev");
  const [mail] = (await res.json()) as { link: string }[];
  await gotoHydrated(page, mail?.link ?? "/");
  await expect(page).toHaveURL(/\/redefinir-senha$/);
  const sizes = await page
    .locator("main input:not([type=hidden])")
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(sizes).toHaveLength(2);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});
