import { expect, snap, test } from "./support/fixtures";
import { openRoute, ROUTES } from "./support/routes";

// Same list as the a11y sweep; snap() is a no-op outside the Docker container (VISUAL=1).
for (const route of ROUTES) {
  test(`varredura visual: ${route.path}`, async ({ page }) => {
    await openRoute(page, route);
    await expect(page.getByRole("main")).toBeVisible();
    await snap(page, `sweep-${route.name}`);
  });
}
