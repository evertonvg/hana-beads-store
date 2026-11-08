"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { CartHydrator } from "@/components/cart/CartHydrator";
import { CartSaver } from "@/components/cart/CartSaver";
import { FinishRedirectAuth } from "@/components/conta/FinishRedirectAuth";
import { toastOptions } from "@/components/ui/toast";

// Devtools is a devDependency: the import must be dead code in production builds, so the
// NODE_ENV check sits right around `import()` and the bundler drops the whole branch.
const Devtools =
  process.env.NODE_ENV === "development"
    ? lazy(() =>
        import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
      )
    : null;

/** Client-side providers: server-state cache, URL state adapter and toasts. */
export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session, created lazily so it survives re-renders.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CartHydrator />
      <CartSaver />
      <FinishRedirectAuth />
      <NuqsAdapter>{children}</NuqsAdapter>
      <Toaster toastOptions={toastOptions} />
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
