import type { AuthPort, AuthUser } from "@/lib/data/ports";

import type { MockUser } from "./fixtures";
import { MARKETING_CONSENT_VERSION } from "@/lib/validation/account";

import { getMockStore } from "./store";

const normalize = (email: string) => email.trim().toLowerCase();
const toUser = ({ id, name, email }: MockUser): AuthUser => ({ id, name, email });

export function createMockAuth(): AuthPort {
  return {
    signIn(email, password) {
      const user = getMockStore().users.find((u) => u.email === normalize(email));
      return Promise.resolve(user && user.password === password ? toUser(user) : null);
    },

    signUp(input) {
      const store = getMockStore();
      const email = normalize(input.email);
      if (store.users.some((u) => u.email === email)) {
        return Promise.resolve({ error: "email_em_uso" as const });
      }
      const user: MockUser = {
        // Never derived from the user count: a deleted user's id must not come back.
        id: crypto.randomUUID(),
        name: input.name.trim(),
        email,
        phone: input.phone,
        password: input.password,
        ...(input.cpf ? { cpf: input.cpf } : {}),
      };
      store.users.push(user);
      if (input.address) {
        store.addresses[user.id] = [{ ...input.address, id: crypto.randomUUID(), isDefault: true }];
      }
      const grantedAt = new Date().toISOString();
      const termsVersion = input.termsVersion;
      const grant = (type: "terms" | "privacy" | "email_marketing", version = termsVersion) =>
        store.consents.push({
          userId: user.id,
          type,
          version,
          granted: true,
          grantedAt,
          revokedAt: null,
        });
      grant("terms");
      grant("privacy");
      if (input.marketingEmail) grant("email_marketing", MARKETING_CONSENT_VERSION);
      return Promise.resolve(toUser(user));
    },

    signInWithProvider() {
      // The mock has no real OAuth: every provider logs in as the "ana" fixture.
      const ana = getMockStore().users.find((u) => u.id === "ana");
      return ana ? Promise.resolve(toUser(ana)) : Promise.reject(new Error("fixture ana missing"));
    },

    requestPasswordReset(email) {
      const store = getMockStore();
      const key = normalize(email);
      if (store.users.some((u) => u.email === key)) store.passwordResets.push(key);
      return Promise.resolve();
    },

    userById(id) {
      const user = getMockStore().users.find((u) => u.id === id);
      return Promise.resolve(user ? toUser(user) : null);
    },

    savedCart(userId) {
      const cart = getMockStore().savedCarts[userId];
      return Promise.resolve(cart ? structuredClone(cart) : null);
    },

    saveCart(userId, cart) {
      getMockStore().savedCarts[userId] = structuredClone(cart);
      return Promise.resolve();
    },
  };
}
