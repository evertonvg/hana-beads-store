import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userIdFromSeal } from "@/lib/data/mock/session-cookie";
import { env } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED = /^\/conta(\/|$)/;

/** Sends to /entrar, remembering where the visitor was going. */
function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${url.pathname}${url.search}`;
  url.pathname = "/entrar";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * Supabase: refreshes the session on every navigation. Both modes: visitors without a session are
 * sent from /conta to /entrar.
 */
export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED.test(request.nextUrl.pathname);
  if (env.DATA_SOURCE === "supabase") {
    const { response, userId } = await updateSession(request);
    return isProtected && !userId ? toSignIn(request) : response;
  }
  if (!isProtected) return NextResponse.next();
  const userId = await userIdFromSeal(request.cookies.get(SESSION_COOKIE)?.value);
  return userId ? NextResponse.next() : toSignIn(request);
}

// Every route except static files (the @supabase/ssr pattern): the refresh must run on any navigation.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
