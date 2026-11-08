/**
 * How long a session opened by an e-mail link may set a new password without the current one
 * (/redefinir-senha). After that, the normal change in /conta (current password) applies.
 */
export const LINK_RESET_WINDOW_SECONDS = 15 * 60;

/** True when `signedInAtMs` (epoch ms) is within the window, measured from `nowMs`. */
export function withinLinkResetWindow(signedInAtMs: number, nowMs: number = Date.now()): boolean {
  return (
    nowMs - signedInAtMs >= -60_000 && nowMs - signedInAtMs <= LINK_RESET_WINDOW_SECONDS * 1000
  );
}
