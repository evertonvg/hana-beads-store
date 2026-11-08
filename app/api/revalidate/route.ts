import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { CATALOG_TAG, productTag } from "@/lib/data/supabase/catalog";
import { env } from "@/lib/env";

/** Most slugs per call; the database trigger sends bigger statements in chunks of this size. */
const MAX_SLUGS = 100;

const bodySchema = z.object({
  slugs: z.array(z.string().min(1).max(200)).max(MAX_SLUGS),
});

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time check of `Bearer <REVALIDATE_SECRET>` (hashing first evens out the lengths). */
function authorized(header: string | null): boolean {
  const secret = env.REVALIDATE_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(secret));
}

/**
 * Called by the `products` triggers (pg_net) after a catalog change: expires the catalog listings
 * and the pages of the changed products. `{ expire: 0 }`: price and stock must not be served stale.
 */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response(null, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  revalidateTag(CATALOG_TAG, { expire: 0 });
  for (const slug of new Set(parsed.data.slugs)) revalidateTag(productTag(slug), { expire: 0 });
  return Response.json({ revalidated: true });
}
