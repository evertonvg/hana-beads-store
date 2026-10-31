import { expect, type Locator } from "@playwright/test";

const MIN = 44;

type Measured = { label: string; iconOnly: boolean; height: number; width: number };

/**
 * Asserts every visible link/button under `scope` (a `role=switch` is measured by its row) is at least 44px tall, and 44px wide when it is
 * icon-only (no text of its own). The skip-link is excluded: it is only shown on focus.
 *
 * All elements are measured in ONE browser turn. Measuring them one by one raced with React
 * swapping a Suspense fallback for the real content (the menu's session links), which detached
 * an element between `isVisible()` and `boundingBox()`.
 */
export async function expectTouchTargets(scope: Locator) {
  // Let the CSS transition of a drawer or sheet finish, so nothing is measured mid-slide.
  await scope.evaluateAll((roots) =>
    Promise.all(
      roots.flatMap((root) =>
        root
          .getAnimations({ subtree: true })
          // Endless animations (the ticker) never finish: only wait for finite ones.
          .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? 0))
          .map((a) => a.finished.catch(() => null)),
      ),
    ),
  );
  const measured = await scope.evaluateAll((roots): Measured[] => {
    const out: Measured[] = [];
    const targets = new Set(
      roots.flatMap((root) => [
        ...root.querySelectorAll<HTMLElement>('a:not([href="#conteudo"]), button'),
      ]),
    );
    for (const el of targets) {
      const own = el.getBoundingClientRect();
      if (own.width === 0 || own.height === 0 || getComputedStyle(el).visibility === "hidden") {
        continue;
      }
      // The 64x36 Switch is a design-spec size: its hit area is the whole Field row (label included).
      const box =
        el.getAttribute("role") === "switch" && el.parentElement
          ? el.parentElement.getBoundingClientRect()
          : own;
      out.push({
        label: el.getAttribute("aria-label") ?? el.innerText,
        iconOnly: el.innerText.trim() === "",
        height: box.height,
        width: box.width,
      });
    }
    return out;
  });
  for (const m of measured) {
    expect(m.height, `altura de "${m.label}"`).toBeGreaterThanOrEqual(MIN);
    if (m.iconOnly) expect(m.width, `largura de "${m.label}"`).toBeGreaterThanOrEqual(MIN);
  }
  expect(measured.length).toBeGreaterThan(0);
}
