import { describe, expect, it } from "vitest";
import { MAX_RETURN_PHOTO_BYTES, returnSchema } from "@/lib/validation/return";

const photo = (type = "image/webp", bytes = 10, name = "foto.webp") =>
  new File([new Uint8Array(bytes)], name, { type });

const input = (over: Record<string, unknown> = {}) => ({
  orderId: "ord_0002",
  reason: "defeito",
  description: "A argola quebrou na primeira semana.",
  preference: "troca",
  photos: [] as File[],
  ...over,
});

describe("returnSchema", () => {
  it("accepts a valid request without photos", () => {
    expect(returnSchema.safeParse(input()).success).toBe(true);
  });

  it("accepts up to 4 jpeg, png or webp photos", () => {
    const photos = [photo("image/jpeg"), photo("image/png"), photo("image/webp"), photo()];
    expect(returnSchema.safeParse(input({ photos })).success).toBe(true);
  });

  it("rejects a gif", () => {
    const r = returnSchema.safeParse(input({ photos: [photo("image/gif", 10, "a.gif")] }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/JPG, PNG ou WebP/);
  });

  it("rejects 5 photos", () => {
    const r = returnSchema.safeParse(input({ photos: Array.from({ length: 5 }, () => photo()) }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/4 fotos/);
  });

  it("rejects a 6 MB photo and accepts exactly the limit", () => {
    expect(MAX_RETURN_PHOTO_BYTES).toBe(5 * 1024 * 1024);
    const big = returnSchema.safeParse(input({ photos: [photo("image/png", 6 * 1024 * 1024)] }));
    expect(big.success).toBe(false);
    expect(big.error?.issues[0]?.message).toMatch(/5 MB/);
    const edge = returnSchema.safeParse(
      input({ photos: [photo("image/png", MAX_RETURN_PHOTO_BYTES)] }),
    );
    expect(edge.success).toBe(true);
  });

  it("keeps the description between 10 and 1000 characters", () => {
    expect(returnSchema.safeParse(input({ description: "curta" })).success).toBe(false);
    expect(returnSchema.safeParse(input({ description: "x".repeat(1001) })).success).toBe(false);
    expect(returnSchema.safeParse(input({ description: "x".repeat(1000) })).success).toBe(true);
  });

  it("requires an order and known reason and preference", () => {
    expect(returnSchema.safeParse(input({ orderId: "" })).success).toBe(false);
    expect(returnSchema.safeParse(input({ reason: "nada" })).success).toBe(false);
    expect(returnSchema.safeParse(input({ preference: "nada" })).success).toBe(false);
  });
});
