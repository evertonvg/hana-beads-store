import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE = "pp_remember";
/** "Keep me signed in": 30 days, in seconds. */
export const REMEMBER_MAX_AGE = 2_592_000;

/** With `remember` the auth cookies live 30 days; without it they become browser-session cookies. */
export function applyRememberPolicy(options: CookieOptions, remember: boolean): CookieOptions {
  // Cookie deletions (maxAge 0 or an expiry in the past) must pass through untouched.
  if (
    options.maxAge === 0 ||
    (options.expires && new Date(options.expires).getTime() <= Date.now())
  ) {
    return { ...options };
  }
  if (remember) return { ...options, maxAge: REMEMBER_MAX_AGE };
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
