import type { CartData } from "@/lib/cart/types";
import type { Connection } from "@/lib/data/ports";
import type { Address, Order, Product } from "@/lib/data/types";

import {
  addressFixtures,
  connectionFixtures,
  orderFixtures,
  productFixtures,
  savedCartFixtures,
  userFixtures,
  type MockUser,
} from "./fixtures";

export type MockConsent = {
  userId: string;
  type: "terms" | "privacy" | "email_marketing";
  version: string;
  grantedAt: string;
  /** Set on the record that withdraws a consent; records are only ever appended. */
  revokedAt: string | null;
  granted: boolean;
};

export type MockReturn = {
  protocol: string;
  userId: string;
  orderId: string;
  reason: string;
  description: string;
  preference: string;
  photos: { name: string; type: string; size: number }[];
};

export type MockStore = {
  products: Product[];
  newsletter: { email: string; consentVersion: string }[];
  /** userId -> favorite product ids, in the order they were added. */
  favorites: Record<string, string[]>;
  stockAlerts: { userId: string | null; email: string; productId: string; consentedAt: string }[];
  users: MockUser[];
  /** Append-only consent history of every user. */
  consents: MockConsent[];
  /** userId -> saved addresses. */
  addresses: Record<string, Address[]>;
  /** userId -> linked social accounts. */
  connections: Record<string, Connection[]>;
  /** userId -> cart saved on the server (merged with the guest cart at sign-in). */
  savedCarts: Record<string, CartData>;
  /** E-mails a password-reset link would have been sent to (accounts that exist only). */
  passwordResets: string[];
  orders: Order[];
  /** idempotency key -> id of the order it created. */
  orderKeys: Record<string, string>;
  /** Return requests, in the order they were made (the protocol number follows it). */
  returns: MockReturn[];
  reset(): void;
};

declare global {
  var __ppMock: MockStore | undefined;
}

function createStore(): MockStore {
  const store: MockStore = {
    products: structuredClone([...productFixtures]),
    newsletter: [],
    favorites: {},
    stockAlerts: [],
    users: structuredClone([...userFixtures]),
    consents: [],
    addresses: structuredClone(addressFixtures),
    connections: structuredClone(connectionFixtures),
    savedCarts: structuredClone(savedCartFixtures),
    passwordResets: [],
    orders: structuredClone([...orderFixtures]),
    orderKeys: {},
    returns: [],
    reset() {
      store.products = structuredClone([...productFixtures]);
      store.newsletter = [];
      store.favorites = {};
      store.stockAlerts = [];
      store.users = structuredClone([...userFixtures]);
      store.consents = [];
      store.addresses = structuredClone(addressFixtures);
      store.connections = structuredClone(connectionFixtures);
      store.savedCarts = structuredClone(savedCartFixtures);
      store.passwordResets = [];
      store.orders = structuredClone([...orderFixtures]);
      store.orderKeys = {};
      store.returns = [];
    },
  };
  return store;
}

/** Singleton on globalThis so state survives HMR and shared module graphs. */
export function getMockStore(): MockStore {
  globalThis.__ppMock ??= createStore();
  return globalThis.__ppMock;
}
