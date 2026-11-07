import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { productFixtures } from "@/lib/data/mock/fixtures";
import type { Database } from "@/lib/supabase/database.types";

import { fixtureId } from "../contract/fixture-ids";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (tests/integration/global-setup.ts)`);
  return v;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Secret-key client for test setup. Not lib/supabase/admin.ts: that one imports `server-only`. */
export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    options,
  );
}

/** Client signed in as a real user (publishable key + password grant). */
export async function signedInClient(
  email: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    options,
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`test sign-in failed: ${error.message}`);
  return client;
}

/** Back to the seeded catalog: drops every product and re-inserts the fixtures (same ids and order as seed.sql). */
export async function resetDb(): Promise<void> {
  const admin = serviceClient();
  const base = Date.parse("2026-01-01T00:00:00Z");
  const del = await admin.from("products").delete().not("id", "is", null);
  if (del.error) throw new Error(`resetDb: ${del.error.message}`);
  const ins = await admin.from("products").insert(
    productFixtures.map((p, i) => ({
      id: fixtureId(p.slug),
      slug: p.slug,
      name: p.name,
      description: p.description,
      price_cents: p.priceCents,
      rarity: p.rarity,
      is_new: p.isNew,
      stock: p.stock,
      categories: p.categories,
      category_label: p.categoryLabel,
      colors: p.colors,
      images: p.images,
      art: p.art,
      illustrative: p.illustrative,
      size_cm: p.sizeCm,
      bead_count: p.beadCount,
      options: p.options,
      featured_rank: p.featuredRank,
      created_at: new Date(base + i * 1000).toISOString(),
    })),
  );
  if (ins.error) throw new Error(`resetDb: ${ins.error.message}`);
}

/** Adds `count` filler products (no featured rank, so they sort after the fixtures). */
export async function addFillerProducts(count: number): Promise<void> {
  const rows = Array.from({ length: count }, (_, i) => ({
    slug: `filler-${String(i).padStart(2, "0")}`,
    name: `FILLER ${String(i).padStart(2, "0")}`,
    category_label: "Icones",
    categories: ["icones"],
    stock: 5,
  }));
  const { error } = await serviceClient().from("products").insert(rows);
  if (error) throw new Error(`addFillerProducts: ${error.message}`);
}

/** Sets price_cents per product slug (null clears it). */
export async function setPrices(prices: Record<string, number | null>): Promise<void> {
  const admin = serviceClient();
  for (const [slug, cents] of Object.entries(prices)) {
    const { error } = await admin.from("products").update({ price_cents: cents }).eq("slug", slug);
    if (error) throw new Error(`setPrices: ${error.message}`);
  }
}
