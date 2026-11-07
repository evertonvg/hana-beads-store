import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountPort, AuthProvider, Connection } from "@/lib/data/ports";
import type { Address } from "@/lib/data/types";
import { formatCep, formatCpf } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

import { toPortError } from "./errors";

type Client = SupabaseClient<Database>;

export class NotAvailableYetError extends Error {
  constructor() {
    super("Disponível no sub-projeto 3");
    this.name = "NotAvailableYetError";
  }
}

const PROVIDERS: readonly string[] = ["google", "facebook", "apple"];

/**
 * Read-only bridge so /conta opens in supabase mode; the writes arrive in sub-project 3.
 * Every call checks that `userId` is the session's user.
 */
export function createSupabaseAccountReads(deps: {
  getClient: () => Promise<Client>;
}): AccountPort {
  async function session(userId: string) {
    const c = await deps.getClient();
    const { data, error } = await c.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("session mismatch");
    return { c, user: data.user };
  }
  const unavailable = () => Promise.reject(new NotAvailableYetError());

  return {
    async profile(userId) {
      const { c, user } = await session(userId);
      const { data, error } = await c
        .from("profiles")
        .select("id, name, phone, cpf, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) toPortError(error);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        email: user.email ?? "",
        phone: data.phone ?? "",
        cpf: data.cpf ? formatCpf(data.cpf) : null,
        avatarUrl: data.avatar_url,
      };
    },

    async addresses(userId) {
      const { c } = await session(userId);
      const { data, error } = await c
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) toPortError(error);
      return data.map((a): Address => ({
        id: a.id,
        ...(a.label ? { label: a.label } : {}),
        cep: formatCep(a.cep),
        street: a.street,
        number: a.number,
        ...(a.complement ? { complement: a.complement } : {}),
        district: a.district,
        city: a.city,
        state: a.state,
        isDefault: a.is_default,
      }));
    },

    async consents(userId) {
      const { c } = await session(userId);
      const { data, error } = await c
        .from("consents")
        .select("type, granted, version, granted_at, revoked_at")
        .eq("user_id", userId)
        .order("granted_at", { ascending: true });
      if (error) toPortError(error);
      return data.map((r) => ({
        type: r.type as "terms" | "privacy" | "email_marketing",
        granted: r.granted,
        version: r.version,
        grantedAt: r.granted_at,
        revokedAt: r.revoked_at,
      }));
    },

    async connections(userId) {
      const { user } = await session(userId);
      return (user.identities ?? [])
        .filter((i) => PROVIDERS.includes(i.provider))
        .map((i): Connection => ({
          provider: i.provider as AuthProvider,
          email: typeof i.identity_data?.email === "string" ? i.identity_data.email : null,
        }));
    },

    updateProfile: unavailable,
    changePassword: unavailable,
    upsertAddress: unavailable,
    deleteAddress: unavailable,
    setDefaultAddress: unavailable,
    setConsent: unavailable,
    connect: unavailable,
    disconnect: unavailable,
    exportData: unavailable,
    deleteAccount: unavailable,
  };
}
