import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { publicEnv } from "@/lib/env";
import { parallaxOffset } from "@/lib/motion";

declare global {
  interface Window {
    /** Number of live ScrollTriggers (read by the E2E suite). */
    __ppScrollTriggers?: () => number;
  }
}

/**
 * Moves the `[data-layer]` descendants of `section` on scroll and returns the cleanup.
 * Lives in its own module so GSAP is only fetched after hydration (see ParallaxRoot).
 *
 * Layer attributes: `data-speed` (design speed), `data-axis` ("y" default | "x"), `data-range`
 * (default 260), `data-base` (constant offset, px), `data-rot` (constant rotation, deg) and
 * `data-spin` (extra deg per viewport of progress).
 *
 * Triggers are created inside `gsap.matchMedia()`: never with `prefers-reduced-motion: reduce`
 * (not even on the first pass), and only for layers visible at the current breakpoint.
 */
export function setupParallax(section: HTMLElement): () => void {
  window.__ppScrollTriggers = () => ScrollTrigger.getAll().length;
  gsap.registerPlugin(ScrollTrigger);
  const k = publicEnv.parallaxIntensity;

  const mm = gsap.matchMedia();
  // `desktop` is only listed so the setup re-runs when the breakpoint flips.
  mm.add(
    { motion: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 768px)" },
    (context) => {
      if (!context.conditions?.motion) return;
      // Progress at the moment the section enters (+) and leaves (-) the viewport.
      const edge = () => 0.5 + section.offsetHeight / (2 * window.innerHeight);

      for (const layer of gsap.utils.toArray<HTMLElement>("[data-layer]", section)) {
        if (layer.getClientRects().length === 0) continue; // hidden at this breakpoint
        const speed = Number(layer.dataset.speed ?? 0);
        const range = Number(layer.dataset.range ?? 260);
        const base = Number(layer.dataset.base ?? 0);
        const rot = Number(layer.dataset.rot ?? 0);
        const spin = Number(layer.dataset.spin ?? 0);
        const prop = layer.dataset.axis === "x" ? "x" : "y";
        // Function values are re-evaluated on every refresh (resize, font load).
        const at = (sign: 1 | -1) => ({
          [prop]: () => base + parallaxOffset(sign * edge(), speed, k, range),
          rotation: () => rot + sign * edge() * spin * k,
        });
        gsap.fromTo(
          layer,
          { ...at(1) },
          {
            ...at(-1),
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      }
    },
  );
  return () => mm.revert();
}
