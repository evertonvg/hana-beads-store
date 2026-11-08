import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, SECRET } = vi.hoisted(() => {
  const SECRET = "revalidate-secret-revalidate-secret-0";
  // Read by lib/env when the route module loads.
  process.env.REVALIDATE_SECRET = SECRET;
  return { revalidateTag: vi.fn(), SECRET };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag, cacheTag: vi.fn(), cacheLife: vi.fn() }));

import { POST } from "@/app/api/revalidate/route";

function post(body: unknown, authorization?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== undefined) headers.set("authorization", authorization);
  return POST(
    new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => revalidateTag.mockReset());

describe("POST /api/revalidate", () => {
  it("answers 401 without the Authorization header", async () => {
    expect((await post({ slugs: ["chaveiro-x"] })).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    "Bearer wrong",
    `Bearer ${SECRET}x`,
    `Bearer ${SECRET.slice(0, -1)}`,
    SECRET,
    `Basic ${SECRET}`,
    "Bearer ",
  ])("answers 401 for the wrong secret %j", async (authorization) => {
    expect((await post({ slugs: ["chaveiro-x"] }, authorization)).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ["slugs not an array", { slugs: "x" }],
    ["no slugs", {}],
    ["a slug not a string", { slugs: [1] }],
    ["an empty slug", { slugs: [""] }],
    ["over 100 slugs", { slugs: Array.from({ length: 101 }, (_, i) => `p-${i}`) }],
    ["not JSON", "{oops"],
  ])("answers 400 for %s", async (_, body) => {
    expect((await post(body, `Bearer ${SECRET}`)).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates the catalog and every product tag, expiring them at once", async () => {
    const r = await post({ slugs: ["chaveiro-x", "garota-pixel"] }, `Bearer ${SECRET}`);
    expect(r.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("product:chaveiro-x", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith("product:garota-pixel", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledTimes(3);
  });

  it("accepts exactly 100 slugs and an empty list (catalog only)", async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `p-${i}`);
    expect((await post({ slugs: hundred }, `Bearer ${SECRET}`)).status).toBe(200);
    revalidateTag.mockReset();
    expect((await post({ slugs: [] }, `Bearer ${SECRET}`)).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });
});
