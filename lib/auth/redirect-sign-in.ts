import "server-only";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { FINISH_AUTH_COOKIE, FINISH_AUTH_MAX_AGE } from "./finish-auth-marker";

/** Where an invalid, expired or already used link (or a failed social sign-in) lands. */
export const LINK_ERROR_PATH = "/entrar?erro=link";

/** The auth server refused for too many attempts (429): the link is still valid, try again soon. */
export const RETRY_PATH = "/entrar?erro=tente-de-novo";

/** 303: the browser follows with a GET, whatever the method that reached the route. */
export function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

/** After the session was created: marks the cart sync for the landing page, then redirects. */
export async function signedInRedirect(request: NextRequest, path: string): Promise<NextResponse> {
  (await cookies()).set(FINISH_AUTH_COOKIE, "1", {
    maxAge: FINISH_AUTH_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  return redirectTo(request, path);
}
