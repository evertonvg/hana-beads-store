import type { NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/redirect";
import {
  LINK_ERROR_PATH,
  redirectTo,
  RETRY_PATH,
  signedInRedirect,
} from "@/lib/auth/redirect-sign-in";
import { getData } from "@/lib/data";

/**
 * Return from the social sign-in provider: `?code&next`. Exchanges the code for the session and
 * goes to `next`. No code (the user cancelled, or the provider sent `?error=`) or a refused code
 * lands on the link error; too many attempts (429) on RETRY_PATH. Never logs the code.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!code) return redirectTo(request, LINK_ERROR_PATH);
  const result = await getData().auth.completeOAuth(code);
  if (!result.ok) return redirectTo(request, result.retry ? RETRY_PATH : LINK_ERROR_PATH);
  return signedInRedirect(request, safeNext(params.get("next")));
}
