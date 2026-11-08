import type { APIRequestContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { E2E_REVALIDATE_SECRET, localSupabase } from "./support/env";
import { expect, gotoHydrated, signIn, test, uniqueEmail } from "./support/fixtures";

const PRODUCT = "/produto/garota-pixel";
const cards = (page: Page) => page.getByRole("main").getByRole("article");

/** Same call the `products` triggers make in production (they do nothing on the local stack). */
async function revalidate(request: APIRequestContext, slugs: string[]) {
  const res = await request.post("/api/revalidate", {
    headers: { authorization: `Bearer ${E2E_REVALIDATE_SECRET}` },
    data: { slugs },
  });
  expect(res.status()).toBe(200);
}

/** Renames a product straight in the database, as the admin would. */
async function renameProduct(slug: string, name: string) {
  const { url, secretKey } = localSupabase();
  const admin = createClient(url, secretKey, { auth: { persistSession: false } });
  const { error } = await admin.from("products").update({ name }).eq("slug", slug);
  expect(error).toBeNull();
}

test("/loja lista os 9 produtos do seed com [PREÇO]", async ({ page }) => {
  await page.goto("/loja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SELECIONE SEU ITEM");
  await expect(cards(page)).toHaveCount(9);
  await expect(page.getByRole("main").getByText(/^\d+ itens?/)).toContainText(/9 itens/i);
  // The seed has no prices: no card may show a made-up value.
  for (const card of await cards(page).all()) await expect(card).toContainText("[PREÇO]");
  await expect(page.getByRole("main")).not.toContainText(/R\$\s*\d/);
});

test("/produto/<slug> abre com nome, raridade e [PREÇO]", async ({ page }) => {
  await page.goto("/loja");
  await cards(page)
    .filter({ hasText: "GAROTA PIXEL" })
    .locator(`a[href="${PRODUCT}"]`)
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${PRODUCT}$`));
  await expect(page.getByRole("heading", { level: 1, name: "GAROTA PIXEL" })).toBeVisible();
  await expect(page.getByText("★★★ ÉPICO").first()).toBeVisible();
  await expect(page.getByRole("main").getByText("[PREÇO]").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /VOCÊ TAMBÉM PODE/ })).toBeVisible();
});

test("/loja e /produto vêm do catálogo em cache até /api/revalidate", async ({ page, request }) => {
  const renamed = "GAROTA RENOMEADA";
  await page.goto(PRODUCT);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GAROTA PIXEL");
  try {
    await renameProduct("garota-pixel", renamed);
    // Cached for hours: the database change alone shows nowhere.
    await page.goto("/loja");
    await expect(cards(page).filter({ hasText: "GAROTA PIXEL" })).toHaveCount(1);
    await page.goto(PRODUCT);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GAROTA PIXEL");

    await revalidate(request, ["garota-pixel"]);
    await expect(async () => {
      await page.goto("/loja");
      await expect(cards(page).filter({ hasText: renamed })).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(async () => {
      await page.goto(PRODUCT);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  } finally {
    await renameProduct("garota-pixel", "GAROTA PIXEL");
    await revalidate(request, ["garota-pixel"]);
  }
});

test("o favorito persiste depois de recarregar", async ({ page }) => {
  await signIn(page, "ana@teste.dev", "Senha@123", { next: "/loja" });
  await expect(page).toHaveURL(/\/loja$/);
  const heart = page.getByRole("button", { name: "Favoritar GAROTA PIXEL" });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  // Undo, so a rerun against the same database starts from the seed again.
  await gotoHydrated(page, "/loja");
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(heart).toHaveAttribute("aria-pressed", "false");
});

test("newsletter responde com a mensagem neutra, também para e-mail repetido", async ({ page }) => {
  const email = uniqueEmail("news");
  await page.goto("/");
  const messages: string[] = [];
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("Seu e-mail").fill(email);
    await page.getByRole("checkbox", { name: /novidades/i }).click();
    await page.getByRole("button", { name: "YES!" }).click();
    await expect(page.getByRole("status")).toContainText("YES!");
    messages.push((await page.getByRole("status").textContent()) ?? "");
  }
  expect(messages[1]).toBe(messages[0]);
});
