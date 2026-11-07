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

export type MockInboxMessage = {
  to: string;
  kind: "confirmacao" | "recuperacao";
  /** `/auth/confirm?token_hash=<uuid>&type=email|recovery&next=<next>` */
  link: string;
};

/** A single-use e-mail link token (deleted once used). */
export type MockEmailToken = { userId: string; type: "email" | "recovery" };

export type MockStore = {
  products: Product[];
  newsletter: { email: string; consentVersion: string }[];
  /** userId -> favorite product ids, in the order they were added. */
  favorites: Record<string, string[]>;
  stockAlerts: { userId: string | null; email: string; productId: string; consentedAt: string }[];
  /** Confirmed accounts (the only ones that can sign in). */
  users: MockUser[];
  /** Accounts created and not confirmed yet; confirming moves them to `users`. */
  pendingUsers: MockUser[];
  /** Auth e-mails that would have been sent, oldest first. */
  inbox: MockInboxMessage[];
  /** token_hash -> what it confirms. */
  emailTokens: Record<string, MockEmailToken>;
  /** Fixed-window attempt counters: key -> window start (ms) and count. */
  rateLimits: Record<string, { windowStart: number; count: number }>;
  /** Append-only consent history of every user. */
  consents: MockConsent[];
  /** userId -> saved addresses. */
  addresses: Record<string, Address[]>;
  /** userId -> linked social accounts. */
  connections: Record<string, Connection[]>;
  /** userId -> cart saved on the server (merged with the guest cart at sign-in). */
  savedCarts: Record<string, CartData>;
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
    pendingUsers: [],
    inbox: [],
    emailTokens: {},
    rateLimits: {},
    consents: [],
    addresses: structuredClone(addressFixtures),
    connections: structuredClone(connectionFixtures),
    savedCarts: structuredClone(savedCartFixtures),
    orders: structuredClone([...orderFixtures]),
    orderKeys: {},
    returns: [],
    reset() {
      store.products = structuredClone([...productFixtures]);
      store.newsletter = [];
      store.favorites = {};
      store.stockAlerts = [];
      store.users = structuredClone([...userFixtures]);
      store.pendingUsers = [];
      store.inbox = [];
      store.emailTokens = {};
      store.rateLimits = {};
      store.consents = [];
      store.addresses = structuredClone(addressFixtures);
      store.connections = structuredClone(connectionFixtures);
      store.savedCarts = structuredClone(savedCartFixtures);
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
