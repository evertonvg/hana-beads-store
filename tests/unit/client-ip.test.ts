import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
import { parseClientIp } from "@/lib/client-ip";

describe("parseClientIp", () => {
  it("takes the first item of the list", () => {
    expect(parseClientIp("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
  });
  it("returns null for null or empty", () => {
    expect(parseClientIp(null)).toBeNull();
    expect(parseClientIp("")).toBeNull();
    expect(parseClientIp("  , 1.2.3.4")).toBeNull();
  });
  it("returns null for values longer than 45 characters", () => {
    expect(parseClientIp("a".repeat(100))).toBeNull();
  });
});
