import { createHash } from "node:crypto";

/** Fixed namespace for the deterministic product UUIDs (v5). Never change it: the seed depends on it. */
export const FIXTURE_NAMESPACE = "6f1f5e0e-6c5a-4b3e-9a57-2f7a9c1d8e41";

/** UUID v5 (RFC 4122, SHA-1) of `name` under `namespace`. */
export function uuidv5(name: string, namespace: string = FIXTURE_NAMESPACE): string {
  const ns = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Product id in the database for a fixture, derived from its slug. */
export function fixtureId(slug: string): string {
  return uuidv5(slug);
}

/** Maps a fixture slug to the product id a given adapter uses. */
export type FixtureIds = {
  id(slug: string): string;
  /** A well-formed id that matches no product. */
  unknown: string;
};

/** Supabase adapter: UUID v5 of the slug, as in the seed. */
export const supabaseIds: FixtureIds = {
  id: fixtureId,
  unknown: "00000000-0000-4000-8000-000000000000",
};
