import { expect, type Page } from "@playwright/test";
import { login } from "./fixtures";
import { gotoHydrated } from "./hydration";

export type SweepRoute = {
  /** Used in snapshot and test names. */
  name: string;
  path: string;
  /** Expected HTTP status of the document. */
  status?: number;
  /** Needs a signed-in fixture user (ana). */
  auth?: boolean;
  /** Needs a cart line so the page renders its form instead of redirecting. */
  cart?: boolean;
};

/** Canonical route list shared by the a11y and visual sweeps. */
export const ROUTES: SweepRoute[] = [
  { name: "home", path: "/" },
  { name: "loja", path: "/loja" },
  { name: "produto-garota-pixel", path: "/produto/garota-pixel" },
  { name: "produto-planeta-pixel", path: "/produto/planeta-pixel" },
  { name: "encomendas", path: "/encomendas" },
  { name: "carrinho", path: "/carrinho" },
  { name: "entrar", path: "/entrar" },
  { name: "cadastro", path: "/cadastro" },
  { name: "privacidade", path: "/privacidade" },
  { name: "termos", path: "/termos" },
  { name: "trocas", path: "/trocas" },
  { name: "rota-inexistente", path: "/rota-inexistente", status: 404 },
  { name: "conta", path: "/conta", auth: true },
  { name: "conta-pedidos", path: "/conta/pedidos", auth: true },
  { name: "checkout", path: "/checkout", auth: true, cart: true },
];

const CART_KEY = "pp_cart_v1";

/** Puts one line in the persisted cart so /checkout renders the form. */
export async function seedCart(page: Page) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    CART_KEY,
    JSON.stringify({
      state: { lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }] },
      version: 1,
    }),
  ] as [string, string]);
}

/** Opens a sweep route, signing in and seeding the cart first when it needs them. */
export async function openRoute(page: Page, route: SweepRoute) {
  if (route.cart) await seedCart(page);
  if (route.auth) {
    await login(page, "ana");
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
  }
  const response = await page.goto(route.path);
  // Web-first readiness: the page body is up (and the checkout form, which renders after hydration).
  await expect(page.getByRole("main")).toBeVisible();
  if (route.cart) {
    await expect(page.getByRole("heading", { level: 1, name: "SAVE GAME" })).toBeVisible();
  }
  return response;
}

export { gotoHydrated };
