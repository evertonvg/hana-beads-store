import { expect, test } from "./support/fixtures";

test("o título da seção fica abaixo do cabeçalho fixo depois de pular pelo índice", async ({
  page,
}) => {
  await page.goto("/termos");
  await page
    .getByRole("navigation", { name: "Nesta página" })
    .getByRole("link", { name: /Entrega/ })
    .click();
  const heading = page.locator("#t7 h2");
  await expect(heading).toBeInViewport({ ratio: 1 });
  const header = await page.locator("header:visible").first().boundingBox();
  const box = await heading.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
});
