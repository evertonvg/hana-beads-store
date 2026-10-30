import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { gotoHydrated } from "./hydration";

type FixtureUser = "ana" | "bruno";

/** Signs in through the /entrar form with a fixture user (waits for hydration so the click submits via React). */
async function login(page: Page, user: FixtureUser = "ana") {
  await gotoHydrated(page, "/entrar");
  await page.getByLabel("E-mail").fill(`${user}@teste.dev`);
  await page.getByLabel("Senha").fill("Senha@123");
  await page.getByRole("button", { name: "ENTRAR" }).click();
}

/** Fails the test on any WCAG 2.0/2.1 A/AA violation. */
async function expectA11y(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(violations).toEqual([]);
}

/**
 * Visual snapshot. Only compares inside the Docker container (VISUAL=1); no-op elsewhere.
 * Pages are captured full-length from the top (so a sticky header never lands mid-image after a
 * focus scroll); pass `{ fullPage: false }` for overlays (drawers, sheets), which belong to the viewport.
 */
async function snap(page: Page, name: string, options: { fullPage?: boolean } = {}) {
  if (process.env.VISUAL !== "1") return;
  const fullPage = options.fullPage ?? true;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
  // The banner mounts after hydration, so wait briefly instead of testing visibility once.
  const reject = page.getByRole("button", { name: "REJEITAR OPCIONAIS" });
  try {
    await reject.click({ timeout: 1500 });
  } catch {
    // No banner on this page (consent already stored): nothing to dismiss.
  }
  if (fullPage) await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
}

export type ConsentState = "rejected" | "accepted" | "unset";

/**
 * Builds the pp_consent cookie exactly as vanilla-cookieconsent writes it for revision 1
 * (JSON, URL-encoded). Keep `revision` in sync with lib/consent.ts.
 */
export function consentCookieValue(state: Exclude<ConsentState, "unset">): string {
  const now = new Date();
  const accepted = state === "accepted";
  const iso = now.toISOString();
  return encodeURIComponent(
    JSON.stringify({
      categories: accepted ? ["necessary", "performance", "marketing"] : ["necessary"],
      revision: 1,
      data: null,
      consentTimestamp: iso,
      consentId: crypto.randomUUID(),
      services: {
        necessary: [],
        performance: [],
        marketing: [],
      },
      languageCode: "pt-BR",
      lastConsentTimestamp: iso,
      expirationTime: now.getTime() + 180 * 24 * 60 * 60 * 1000,
    }),
  );
}

export const test = base.extend<{ resetMock: void; consent: ConsentState; seedConsent: void }>({
  // Default "rejected" keeps the banner from covering the TabBar and CTAs in unrelated specs.
  consent: ["rejected", { option: true }],
  seedConsent: [
    async ({ context, baseURL, consent }, use) => {
      if (consent !== "unset") {
        await context.addCookies([
          {
            name: "pp_consent",
            value: consentCookieValue(consent),
            url: baseURL ?? "http://localhost:3100",
          },
        ]);
      }
      await use();
    },
    { auto: true },
  ],
  resetMock: [
    async ({ request }, use) => {
      await request.post("/api/__mock__/reset");
      // localStorage and cookies need no clearing: each test gets a fresh browser context.
      await use();
    },
    { auto: true },
  ],
});

export { expect, expectA11y, login, snap };
