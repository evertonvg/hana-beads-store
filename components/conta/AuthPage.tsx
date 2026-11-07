import { Suspense } from "react";
import { safeNext } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import { AuthScreen, type AuthMode } from "./AuthScreen";
import type { AuthTab } from "./AuthTabs";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Placeholder with the real page's height: no inputs, so nothing can be typed into it. */
export function AuthFallback() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pt-6 md:px-6 md:pt-[72px]">
      <div aria-hidden="true" className="min-h-[640px]" />
    </div>
  );
}

/** First value of a query parameter that may repeat. */
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Screen({
  searchParams,
  initialTab,
}: {
  searchParams: SearchParams;
  initialTab: AuthTab;
}) {
  const params = await searchParams;
  const tab = initialTab === "criar" || first(params.aba) === "criar" ? "criar" : "entrar";
  const mode: AuthMode = first(params.modo) === "recuperar" ? "recuperar" : "entrar";
  return (
    <AuthScreen
      // Same-route query changes (?aba=, ?modo=) must reset the tab and mode kept in state.
      key={`${tab}:${mode}`}
      initialTab={tab}
      initialMode={mode}
      next={safeNext(first(params.next))}
      authApple={publicEnv.authApple}
    />
  );
}

/** Shared body of /entrar and /cadastro: the query string is read inside Suspense (dynamic data). */
export function AuthPage({
  searchParams,
  initialTab,
}: {
  searchParams: SearchParams;
  initialTab: AuthTab;
}) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Screen searchParams={searchParams} initialTab={initialTab} />
    </Suspense>
  );
}
