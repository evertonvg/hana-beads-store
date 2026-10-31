"use client";

import { useState, useTransition, type ReactNode } from "react";
import { socialAction } from "@/app/(conta)/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { AuthProvider } from "@/lib/data/ports";
import { useFinishAuth } from "./use-finish-auth";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const base = cn(
  "flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-3 border-[3px] px-4 font-sans text-sm font-medium",
  "disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

const BUTTONS: { provider: AuthProvider; label: string; logo: ReactNode; className: string }[] = [
  {
    provider: "google",
    label: "Continuar com Google",
    logo: <GoogleLogo />,
    className: "border-text bg-white text-[#1f1f1f]",
  },
  {
    provider: "apple",
    label: "Continuar com Apple",
    logo: <AppleLogo />,
    className: "border-text bg-black text-white",
  },
  {
    provider: "facebook",
    label: "Continuar com Facebook",
    logo: <FacebookLogo />,
    className: "border-[#166fe5] bg-[#166fe5] text-white",
  },
];

type Props = { next: string; apple: boolean };

/** Social sign-in buttons with each provider's brand look; Apple only when enabled. */
export function SocialButtons({ next, apple }: Props) {
  const finish = useFinishAuth();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (provider: AuthProvider) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await socialAction(provider, next);
        if (result.status === "ok" && result.redirectTo) {
          await finish(result.redirectTo);
          return;
        }
        setError(result.message ?? GENERIC_ERROR);
      } catch {
        setError(GENERIC_ERROR);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {BUTTONS.filter((b) => b.provider !== "apple" || apple).map((b) => (
        <button
          key={b.provider}
          type="button"
          disabled={pending}
          onClick={() => run(b.provider)}
          className={cn(base, b.className)}
        >
          {b.logo}
          {b.label}
        </button>
      ))}
      <FormMessage error={error} />
    </div>
  );
}
