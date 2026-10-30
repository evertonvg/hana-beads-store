import Link from "next/link";
import { Suspense } from "react";
import { focusRing } from "@/components/ui/focus";
import { PixelGrid } from "@/components/pixel/PixelGrid";
import { cn } from "@/lib/cn";
import { getContact } from "@/lib/contact";
import { CartLink } from "./CartLink";
import { MobileHeader } from "./MobileHeader";

export type HeaderSession = { name: string } | null;

const accountLink = (signedIn: boolean) => (
  <Link href={signedIn ? "/conta" : "/entrar"} className={navLink}>
    {signedIn ? "MINHA CONTA" : "ENTRAR"}
  </Link>
);

/** Account link of the desktop nav: waits for the session, so it sits inside Suspense. */
async function AccountLink({ session }: { session: Promise<HeaderSession> }) {
  return accountLink((await session) !== null);
}

const LOGO_ROWS = ["aya", "yty", "aya"];
const LOGO_PALETTE = {
  a: "var(--color-accent)",
  y: "var(--color-yellow)",
  t: "var(--color-text)",
};

const navLink = cn("inline-flex min-h-11 min-w-11 items-center justify-center", focusRing);

/**
 * Site header: desktop bar from `md`, compact bar with menu button below it.
 * `session` is a promise on purpose: the static shell shows the signed-out state and only the
 * account bits wait for it (cookies are request-time data).
 */
export function Header({ session }: { session: Promise<HeaderSession> }) {
  const channel = getContact();
  return (
    <>
      <header className="hidden border-b-4 border-border-soft md:block">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className={cn("flex min-h-11 items-center gap-3 text-text", focusRing)}>
            <PixelGrid rows={LOGO_ROWS} palette={LOGO_PALETTE} cell={10} gap={2} />
            <span className="font-pixel text-sm leading-normal">
              PIXEL PERFECT
              <br />
              <span className="text-[9px] text-text-subtle">ARTESANATO</span>
            </span>
          </Link>
          <nav
            aria-label="Principal"
            className="flex flex-wrap gap-6 font-pixel text-[10px] text-text"
          >
            <Link href="/loja" className={navLink}>
              LOJA
            </Link>
            <Link href="/encomendas" className={navLink}>
              ENCOMENDAS
            </Link>
            <Link href="/#sobre" className={navLink}>
              SOBRE
            </Link>
            <Suspense fallback={accountLink(false)}>
              <AccountLink session={session} />
            </Suspense>
          </nav>
          <CartLink variant="desktop" />
        </div>
      </header>
      <MobileHeader
        session={session}
        contact={{ label: `Falar no ${channel.name}`, href: channel.href() }}
      />
    </>
  );
}
