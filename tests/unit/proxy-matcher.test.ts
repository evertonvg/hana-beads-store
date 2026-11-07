import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

// Next anchors each matcher source as a whole-path regular expression.
const matches = (path: string) =>
  config.matcher.some((source) => new RegExp(`^${source}$`).test(path));

describe("proxy matcher", () => {
  it.each(["/", "/conta", "/conta/pedidos", "/conta/x-png", "/loja/svg"])("runs on %s", (path) =>
    expect(matches(path)).toBe(true),
  );

  it.each(["/logo.svg", "/img/foto.webp", "/_next/static/x.js", "/_next/image", "/favicon.ico"])(
    "skips the static file %s",
    (path) => expect(matches(path)).toBe(false),
  );
});
