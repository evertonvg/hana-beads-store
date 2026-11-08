"use client";

import { useEffect } from "react";
import { FINISH_AUTH_COOKIE } from "@/lib/auth/finish-auth-marker";
import { useCartStore } from "@/lib/cart/store";
import { syncCartAfterSignIn } from "./use-finish-auth";

/** True (once) when a redirect sign-in left the marker; deletes it so the sync runs only once. */
function takeMarker(): boolean {
  const present = document.cookie.split(";").some((c) => c.trim() === `${FINISH_AUTH_COOKIE}=1`);
  if (present) document.cookie = `${FINISH_AUTH_COOKIE}=; Max-Age=0; Path=/`;
  return present;
}

/**
 * Mounted once (in Providers). The e-mail link and social sign-ins land through a redirect, not
 * through the forms that sync the cart: when /auth/confirm or /auth/callback left the marker, the
 * page they land on runs the same sync, after the local cart has loaded.
 */
export function FinishRedirectAuth() {
  useEffect(() => {
    let checked = false;
    const check = () => {
      if (checked) return;
      checked = true;
      if (takeMarker()) void syncCartAfterSignIn();
    };
    const unsubscribe = useCartStore.persist.onFinishHydration(check);
    if (useCartStore.persist.hasHydrated()) check();
    return unsubscribe;
  }, []);
  return null;
}
