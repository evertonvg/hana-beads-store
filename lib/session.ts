import { connection } from "next/server";
import { cache } from "react";
import { getData } from "@/lib/data";

export type SessionUser = { id: string; name: string; email: string };

/**
 * Current signed-in user, or null (no session, or a user that no longer exists). The data adapter
 * owns the session cookies; reading them makes callers sit inside a Suspense boundary.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  // Checking expiry reads the clock, which Next forbids in prefetch renders: opt out of them.
  await connection();
  return getData().auth.currentUser();
});
