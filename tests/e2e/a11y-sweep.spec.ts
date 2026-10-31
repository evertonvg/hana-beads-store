import { expect, expectA11y, test } from "./support/fixtures";
import { openRoute, ROUTES } from "./support/routes";

const MIN = 44;

for (const route of ROUTES) {
  test(`varredura a11y: ${route.path}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // The browser logs the failed document load itself for the 404 route.
      if (route.status === 404 && /status of 404/.test(msg.text())) return;
      problems.push(`console.error: ${msg.text()}`);
    });

    const response = await openRoute(page, route);
    expect(response?.status()).toBe(route.status ?? 200);
    await expect(page.getByRole("main")).toBeVisible();

    // 1. axe WCAG 2.0/2.1 A + AA
    await expectA11y(page);

    // 2. Every visible interactive target is at least 44x44, except inline links inside running text.
    const small = await page.evaluate((min) => {
      const sel =
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="switch"], [role="radio"], [role="tab"], [role="checkbox"]';
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        // Inline links inside running text are exempt. The skip link is only shown on focus, so it is
        // measured separately (see the focused skip link check below).
        if (el.matches('a[href="#conteudo"]') || (el.closest("p") !== null && el.matches("p a")))
          continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const own = el.getBoundingClientRect();
        let rect = own;
        // Switch and checkbox draw a small box; the target is the row that holds the box AND its
        // label, because clicking the label toggles it. The row is the closest common ancestor of
        // the control and its labelling element. A pill radio is NOT exempt: each one is its own target.
        const role = el.getAttribute("role");
        if (role === "switch" || role === "checkbox") {
          const labelId = el.getAttribute("aria-labelledby")?.split(" ")[0];
          const labelEl = labelId ? document.getElementById(labelId) : null;
          let row: HTMLElement | null = el.parentElement;
          while (row && labelEl && !row.contains(labelEl)) row = row.parentElement;
          if (row && labelEl) rect = row.getBoundingClientRect();
        }
        const label = el.id ? document.querySelector<HTMLElement>(`label[for="${el.id}"]`) : null;
        if (own.width * own.height === 0 && label) rect = label.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.width < min - 0.5 || rect.height < min - 0.5) {
          const name = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? "";
          out.push(
            `${el.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
          );
        }
      }
      return out;
    }, MIN);
    expect.soft(small, "alvos menores que 44x44").toEqual([]);

    // The skip link is hidden until focused: once focused it must also be a 44x44 target.
    await page.keyboard.press("Tab");
    const skip = page.locator('a[href="#conteudo"]');
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect.soft(box?.height, "altura do skip link focado").toBeGreaterThanOrEqual(MIN);
    expect.soft(box?.width, "largura do skip link focado").toBeGreaterThanOrEqual(MIN);

    // 3. No border-radius anywhere except beads.
    const rounded = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        if (el.closest(".bead")) continue;
        const s = getComputedStyle(el);
        const r = [
          s.borderTopLeftRadius,
          s.borderTopRightRadius,
          s.borderBottomLeftRadius,
          s.borderBottomRightRadius,
        ];
        if (r.some((v) => parseFloat(v) > 0)) {
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${r[0]}`);
        }
      }
      return out;
    });
    expect.soft(rounded, "elementos com border-radius").toEqual([]);

    // 4. No horizontal overflow (checked on both viewports, the phone is the one that matters).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect.soft(overflow, "overflow horizontal").toBeLessThanOrEqual(0);

    // 5. Clean console.
    expect(problems).toEqual([]);
  });
}
