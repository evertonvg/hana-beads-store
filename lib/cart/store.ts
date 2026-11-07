import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { sanitizeCart } from "./merge";
import { clampQty, lineKey, MAX_CART_LINES, type CartData, type CartLine } from "./types";

export type CartStore = CartData & {
  /** User id the lines were last synced with; null = guest cart. */
  owner: string | null;
  lastRemoved: { line: CartLine; index: number } | null;
  count(): number;
  add(line: CartLine): void;
  setQty(key: string, qty: number): void;
  remove(key: string): void;
  undo(): void;
  clear(): void;
  replace(d: CartData): void;
  setOwner(owner: string | null): void;
  /** Sign-out: forgets the owner and empties the cart so the next person on the device starts clean. */
  release(): void;
  pruneUnknown(ids: string[]): void;
};

export const CART_STORAGE_KEY = "pp_cart_v1";

/**
 * Set when localStorage throws (blocked, quota); cleared by the next successful read/write. While
 * set, a rehydrate that reads nothing must not wipe the in-memory cart.
 */
let readFailed = false;
let writeFailed = false;

/** localStorage guarded against blocked storage and corrupted JSON (falls back to empty). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
      readFailed = false;
    } catch {
      readFailed = true;
      return null;
    }
    if (raw === null) return null;
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      writeFailed = false;
    } catch {
      // Storage full or blocked: the cart stays in memory only.
      writeFailed = true;
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      writeFailed = true;
    }
  },
};

/** Untrusted stored value: anything but a non-empty string is "no owner". */
function ownerOf(raw: unknown): string | null {
  const owner = typeof raw === "object" && raw !== null ? (raw as { owner?: unknown }).owner : null;
  return typeof owner === "string" && owner !== "" ? owner : null;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      owner: null,
      lastRemoved: null,
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      add: (line) =>
        set((s) => {
          const key = lineKey(line);
          const exists = s.lines.some((l) => lineKey(l) === key);
          if (!exists && s.lines.length >= MAX_CART_LINES) return {}; // cap: see MAX_CART_LINES
          return {
            lines: exists
              ? s.lines.map((l) =>
                  lineKey(l) === key ? { ...l, qty: clampQty(l.qty + clampQty(line.qty)) } : l,
                )
              : [...s.lines, { ...line, qty: clampQty(line.qty) }],
          };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines: s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(qty) } : l)),
        })),
      remove: (key) =>
        set((s) => {
          const index = s.lines.findIndex((l) => lineKey(l) === key);
          const line = s.lines[index];
          if (!line) return s;
          return { lines: s.lines.filter((_, i) => i !== index), lastRemoved: { line, index } };
        }),
      undo: () =>
        set((s) => {
          if (!s.lastRemoved) return s;
          const { line, index } = s.lastRemoved;
          if (s.lines.some((l) => lineKey(l) === lineKey(line))) return { lastRemoved: null };
          const lines = [...s.lines];
          lines.splice(Math.min(index, lines.length), 0, line);
          return { lines, lastRemoved: null };
        }),
      clear: () => set({ lines: [], lastRemoved: null }),
      replace: (d) => set({ lines: sanitizeCart(d).lines, lastRemoved: null }),
      setOwner: (owner) => set({ owner }),
      release: () => set({ owner: null, lines: [], lastRemoved: null }),
      pruneUnknown: (ids) =>
        set((s) => ({ lines: s.lines.filter((l) => ids.includes(l.productId)) })),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ lines: s.lines, owner: s.owner }),
      // v1 had no owner: its cart counts as a guest cart.
      migrate: (old) => ({ ...sanitizeCart(old), owner: ownerOf(old) }),
      merge: (persisted, current) =>
        persisted === undefined && (readFailed || writeFailed)
          ? current
          : { ...current, ...sanitizeCart(persisted), owner: ownerOf(persisted) },
      skipHydration: true,
    },
  ),
);
