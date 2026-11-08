"use client";

import { useRouter } from "next/navigation";
import { syncCartAction } from "@/app/(conta)/actions";
import { useCartStore } from "@/lib/cart/store";

/**
 * Right after a sign-in: sends the local cart and its owner to the server, which reconciles it
 * with the saved one; the result replaces the local cart, which is marked as this user's. A failed
 * sync keeps the local cart.
 */
export async function syncCartAfterSignIn(): Promise<void> {
  try {
    const { lines, owner } = useCartStore.getState();
    const synced = await syncCartAction(lines, owner);
    if (synced) {
      useCartStore.getState().replace({ lines: synced.lines });
      useCartStore.getState().setOwner(synced.owner);
    }
  } catch {
    // Offline or server error: the local cart stays as it is.
  }
}

/**
 * After a successful sign-in/sign-up form: syncs the cart (`syncCartAfterSignIn`) and then takes
 * the user to `redirectTo` (already sanitized by the action), even when the sync failed.
 */
export function useFinishAuth() {
  const router = useRouter();
  return async (redirectTo: string) => {
    await syncCartAfterSignIn();
    // The session cookie just changed: push goes to the page, refresh re-reads the layout (header).
    router.push(redirectTo);
    router.refresh();
  };
}
