import { z } from "zod";
import {
  clampQty,
  MAX_CART_LINES,
  lineKey,
  RING_OPTIONS,
  type CartData,
  type CartLine,
} from "./types";

function isLine(raw: unknown): raw is CartLine {
  if (typeof raw !== "object" || raw === null) return false;
  const l = raw as Record<string, unknown>;
  return (
    typeof l.productId === "string" &&
    l.productId !== "" &&
    typeof l.ring === "string" &&
    (RING_OPTIONS as readonly string[]).includes(l.ring) &&
    typeof l.qty === "number"
  );
}

function sumLines(lines: CartLine[]): CartLine[] {
  const byKey = new Map<string, CartLine>();
  for (const line of lines) {
    const key = lineKey(line);
    const prev = byKey.get(key);
    byKey.set(key, {
      productId: line.productId,
      ring: line.ring,
      qty: clampQty((prev?.qty ?? 0) + clampQty(line.qty)),
    });
  }
  return [...byKey.values()];
}

const linesSchema = z.array(z.unknown());

/** Server boundary: a client never sends more than MAX_CART_LINES lines, so more is tampering. */
export function hasTooManyLines(lines: unknown): boolean {
  return Array.isArray(lines) && lines.length > MAX_CART_LINES;
}

/** Sums repeated keys, then keeps at most MAX_CART_LINES lines (the first ones win). */
function capLines(lines: CartLine[]): CartLine[] {
  return sumLines(lines).slice(0, MAX_CART_LINES);
}

/**
 * Validates untrusted data (localStorage, old versions, server actions): an invalid shape gives an
 * empty cart; more than MAX_CART_LINES lines are cut, never wiping the whole cart.
 */
export function sanitizeCart(raw: unknown): CartData {
  if (typeof raw !== "object" || raw === null) return { lines: [] };
  const parsed = linesSchema.safeParse((raw as { lines?: unknown }).lines);
  if (!parsed.success) return { lines: [] };
  return { lines: capLines(parsed.data.filter(isLine)) };
}

/** Sums by key (clamped at 99); saved lines come first, up to MAX_CART_LINES. */
export function mergeCarts(guest: CartData, saved: CartData): CartData {
  return { lines: capLines([...saved.lines, ...guest.lines]) };
}
