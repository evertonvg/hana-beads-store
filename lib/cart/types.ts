import type { RingOption } from "@/lib/data/types";

/** A cart line. The line key is `${productId}:${ring}`. */
export type CartLine = { productId: string; ring: RingOption; qty: number };
export type CartData = { lines: CartLine[] };

export const MAX_QTY = 99;
/** Most lines accepted from the client (10 products x 2 rings is far below). Longer = malformed. */
export const MAX_CART_LINES = 50;
export const RING_OPTIONS: readonly RingOption[] = ["mosquetao", "estrela"];

export function lineKey(line: Pick<CartLine, "productId" | "ring">): string {
  return `${line.productId}:${line.ring}`;
}

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.trunc(qty)));
}
