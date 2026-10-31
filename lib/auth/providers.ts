import type { AuthProvider } from "@/lib/data/ports";

export const AUTH_PROVIDERS: readonly AuthProvider[] = ["google", "facebook", "apple"];

/**
 * Narrows an untrusted value to a provider the site offers; Apple only when it is switched on
 * (`NEXT_PUBLIC_AUTH_APPLE`). Used by every server action that takes a provider.
 */
export function parseProvider(value: unknown, authApple: boolean): AuthProvider | null {
  const found = AUTH_PROVIDERS.find((p) => p === value);
  return found && (found !== "apple" || authApple) ? found : null;
}
