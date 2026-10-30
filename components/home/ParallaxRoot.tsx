"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/**
 * Section that moves its `[data-layer]` descendants on scroll. GSAP (about 45 kB gzipped) is
 * imported after hydration so it never competes with the first paint; see `lib/parallax.ts`.
 */
export function ParallaxRoot({ children, ...rest }: Readonly<ComponentPropsWithoutRef<"section">>) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/parallax").then(({ setupParallax }) => {
      if (!cancelled) cleanup = setupParallax(section);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section ref={root} {...rest}>
      {children}
    </section>
  );
}
