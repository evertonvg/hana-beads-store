import Link from "next/link";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getContact } from "@/lib/contact";

const linkClass = cn(
  "inline-flex min-h-11 min-w-11 items-center justify-center text-link underline-offset-4 hover:text-yellow hover:underline",
  focusRing,
);

/** Site footer. Company data are placeholders until the owner provides them. */
export function Footer() {
  const channel = getContact();
  return (
    <footer className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6 px-4 pt-16 pb-10 text-center md:px-6">
      <nav
        aria-label="Rodapé"
        className="flex flex-wrap justify-center gap-x-6 gap-y-1 font-pixel text-[9px] leading-normal"
      >
        <Link href="/loja" className={linkClass}>
          Loja
        </Link>
        <Link href="/encomendas" className={linkClass}>
          Encomendas
        </Link>
        <Link href="/trocas" className={linkClass}>
          Trocas e devoluções
        </Link>
        <Link href="/privacidade" className={linkClass}>
          Privacidade
        </Link>
        <Link href="/termos" className={linkClass}>
          Termos
        </Link>
        <a href={channel.href()} target="_blank" rel="noopener" className={linkClass}>
          {channel.name}
        </a>
        <button
          type="button"
          data-cc="show-preferencesModal"
          className={cn(linkClass, "text-accent underline")}
        >
          Cookies
        </button>
      </nav>
      <p className="text-xs text-text-subtle">
        © Pixel Perfect Artesanato · [razão social] · [00.000.000/0000-00]
      </p>
    </footer>
  );
}
