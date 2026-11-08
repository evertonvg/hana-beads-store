/**
 * One-shot marker set by the routes that sign in through a redirect (/auth/confirm,
 * /auth/callback). Those sign-ins skip the forms that reconcile the cart, so the page they land on
 * (`FinishRedirectAuth`) runs that sync once and deletes the marker. Not httpOnly: the browser
 * reads it, and it carries nothing but "1".
 */
export const FINISH_AUTH_COOKIE = "pp_finish_auth";

/** Long enough for the landing page to load, short enough not to fire on a later visit. */
export const FINISH_AUTH_MAX_AGE = 300;
