import type { NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/redirect";
import { LINK_ERROR_PATH, redirectTo, signedInRedirect } from "@/lib/auth/redirect-sign-in";
import { getData } from "@/lib/data";
import type { EmailLinkType } from "@/lib/data/ports";

/** Where the user picks a new password (recovery, or a re-signed-up account). */
const RESET_PATH = "/redefinir-senha";

const isLinkType = (v: string | null): v is EmailLinkType => v === "email" || v === "recovery";

/**
 * Link of the auth e-mails: `?token_hash&type&next`. Opens the session, then goes to `next` (e-mail
 * confirmation) or to the new-password screen. Never logs the token. An infrastructure failure
 * throws (the link is still unused and can be opened again).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || !isLinkType(type)) return redirectTo(request, LINK_ERROR_PATH);

  const result = await getData().auth.verifyEmailLink(tokenHash, type);
  if (!result.ok) return redirectTo(request, LINK_ERROR_PATH);
  // A re-signed-up account had its password replaced by a random one: it must choose one now.
  if (type === "recovery" || result.mustSetPassword) return signedInRedirect(request, RESET_PATH);
  return signedInRedirect(request, safeNext(params.get("next")));
}
