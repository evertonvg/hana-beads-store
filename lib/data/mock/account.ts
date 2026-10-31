import type { AccountExport, AccountPort, ConsentRecord } from "@/lib/data/ports";
import type { Address } from "@/lib/data/types";

import { getMockStore } from "./store";

const REMOVED = "[removido]";

const user = (userId: string) => getMockStore().users.find((u) => u.id === userId);

/** Consent history of one user, oldest first, without the internal user id. */
function recordsOf(userId: string): ConsentRecord[] {
  return getMockStore()
    .consents.filter((c) => c.userId === userId)
    .map(({ type, granted, version, grantedAt, revokedAt }) => ({
      type,
      granted,
      version,
      grantedAt,
      revokedAt,
    }));
}

/** Stock alerts and newsletter records are keyed by e-mail too (visitors have no user id). */
const ownAlert = (a: { userId: string | null; email: string }, userId: string, email: string) =>
  a.userId === userId || a.email === email;

/** In-memory account data. Every method only reaches the data of the `userId` it is given. */
export function createMockAccount(): AccountPort {
  return {
    profile(userId) {
      const u = user(userId);
      if (!u) return Promise.resolve(null);
      return Promise.resolve({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        cpf: u.cpf ?? null,
        avatarUrl: null,
      });
    },

    updateProfile(userId, p) {
      const u = user(userId);
      if (u) {
        u.name = p.name.trim();
        u.phone = p.phone;
        if (p.cpf) u.cpf = p.cpf;
        else delete u.cpf;
      }
      return Promise.resolve();
    },

    changePassword(userId, current, next) {
      const u = user(userId);
      if (!u || u.password === "" || u.password !== current) {
        return Promise.resolve({ ok: false });
      }
      u.password = next;
      return Promise.resolve({ ok: true });
    },

    addresses(userId) {
      return Promise.resolve(structuredClone(getMockStore().addresses[userId] ?? []));
    },

    upsertAddress(userId, a) {
      const store = getMockStore();
      const list = (store.addresses[userId] ??= []);
      const existing = a.id ? list.find((x) => x.id === a.id) : undefined;
      const saved: Address = {
        ...a,
        id: existing?.id ?? crypto.randomUUID(),
        // The first address is always the default; a later one only when asked for.
        // Editing the only default with "principal" unchecked keeps it default: never zero defaults.
        isDefault:
          list.length === 0 ||
          Boolean(a.isDefault) ||
          (existing?.isDefault === true && !list.some((x) => x !== existing && x.isDefault)),
      };
      if (saved.isDefault) for (const x of list) x.isDefault = false;
      if (existing) list.splice(list.indexOf(existing), 1, saved);
      else list.push(saved);
      return Promise.resolve(structuredClone(saved));
    },

    deleteAddress(userId, id) {
      const list = getMockStore().addresses[userId];
      const at = list?.findIndex((x) => x.id === id) ?? -1;
      if (list && at >= 0) {
        const [removed] = list.splice(at, 1);
        const first = list[0];
        if (removed?.isDefault && first) first.isDefault = true;
      }
      return Promise.resolve();
    },

    setDefaultAddress(userId, id) {
      const list = getMockStore().addresses[userId];
      if (list?.some((x) => x.id === id)) for (const x of list) x.isDefault = x.id === id;
      return Promise.resolve();
    },

    consents(userId) {
      return Promise.resolve(recordsOf(userId));
    },

    setConsent(userId, type, granted, version) {
      const store = getMockStore();
      const now = new Date().toISOString();
      const previous = store.consents.findLast((c) => c.userId === userId && c.type === type);
      store.consents.push({
        userId,
        type,
        granted,
        version,
        // A revocation keeps the date of the grant it withdraws.
        grantedAt: !granted && previous ? previous.grantedAt : now,
        revokedAt: granted ? null : now,
      });
      return Promise.resolve();
    },

    connections(userId) {
      return Promise.resolve(structuredClone(getMockStore().connections[userId] ?? []));
    },

    connect(userId, provider) {
      const u = user(userId);
      const list = (getMockStore().connections[userId] ??= []);
      if (u && !list.some((c) => c.provider === provider)) list.push({ provider, email: u.email });
      return Promise.resolve();
    },

    disconnect(userId, provider) {
      const u = user(userId);
      const list = getMockStore().connections[userId] ?? [];
      const at = list.findIndex((c) => c.provider === provider);
      if (!u || at < 0) return Promise.resolve({ ok: true });
      if (u.password === "" && list.length <= 1) return Promise.resolve({ ok: false });
      list.splice(at, 1);
      return Promise.resolve({ ok: true });
    },

    exportData(userId) {
      const store = getMockStore();
      const u = user(userId);
      if (!u) return Promise.resolve(null);
      const data: AccountExport = {
        exportedAt: new Date().toISOString(),
        profile: { id: u.id, name: u.name, email: u.email, phone: u.phone, cpf: u.cpf ?? null },
        addresses: store.addresses[userId] ?? [],
        consents: recordsOf(userId),
        connections: store.connections[userId] ?? [],
        favorites: store.favorites[userId] ?? [],
        orders: store.orders.filter((o) => o.userId === userId),
        returns: store.returns
          .filter((r) => r.userId === userId)
          .map(({ protocol, orderId, reason, description, preference, photos }) => ({
            protocol,
            orderId,
            reason,
            description,
            preference,
            photos,
          })),
        stockAlerts: store.stockAlerts
          .filter((a) => ownAlert(a, userId, u.email))
          .map(({ email, productId, consentedAt }) => ({ email, productId, consentedAt })),
        newsletter: store.newsletter.find((n) => n.email === u.email) ?? null,
        savedCart: store.savedCarts[userId] ?? null,
      };
      return Promise.resolve(structuredClone(data));
    },

    deleteAccount(userId, password) {
      const store = getMockStore();
      const u = user(userId);
      if (!u || u.password === "" || u.password !== password) {
        return Promise.resolve({ ok: false });
      }
      store.users = store.users.filter((x) => x.id !== userId);
      store.consents = store.consents.filter((c) => c.userId !== userId);
      store.stockAlerts = store.stockAlerts.filter((a) => !ownAlert(a, userId, u.email));
      store.newsletter = store.newsletter.filter((n) => n.email !== u.email);
      store.returns = store.returns.filter((r) => r.userId !== userId);
      delete store.addresses[userId];
      delete store.connections[userId];
      delete store.favorites[userId];
      delete store.savedCarts[userId];
      // Orders stay for the legal retention period, but no longer say who bought.
      for (const order of store.orders) {
        if (order.userId !== userId) continue;
        order.userId = null;
        order.customer = { name: REMOVED, email: REMOVED, phone: REMOVED, cpf: REMOVED };
      }
      return Promise.resolve({ ok: true });
    },
  };
}
