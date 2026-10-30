import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getContact } from "@/lib/contact";

type CanalVariant = "nome" | "short" | "direct" | "via" | "handle" | "link";

/**
 * The configured contact channel, as text inside legal copy. This is the only place the MDX
 * mentions it. Variants are the fields of the contact channel (name, short, direct, via, handle) plus
 * "link", a link to the channel inbox.
 */
export function Canal({ variant = "nome" }: { variant?: CanalVariant }) {
  const channel = getContact();
  if (variant === "link") {
    return (
      <a href={channel.href()} target="_blank" rel="noopener" className={legalLink}>
        {channel.name}
      </a>
    );
  }
  return (
    <>
      {
        {
          nome: channel.name,
          short: channel.short,
          direct: channel.direct,
          via: channel.via,
          handle: channel.handle,
        }[variant]
      }
    </>
  );
}

/** A value the owner still has to provide (company data, deadlines, tools). Kept as written in the draft. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <span data-placeholder>{children}</span>;
}

const legalLink = cn("text-link underline underline-offset-4 hover:text-yellow", focusRing);

/** Numbered section: yellow number + pixel heading, anchor target below the top of the page. */
export function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="flex scroll-mt-24 flex-col gap-4 pt-3 md:scroll-mt-6"
    >
      <h2 id={`${id}-titulo`} className="font-pixel text-[13px] leading-relaxed md:text-[15px]">
        <span className="text-yellow">{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

const RIGHTS = [
  { t: "CONFIRMAÇÃO E ACESSO", d: "Saber se tratamos seus dados e receber uma cópia." },
  { t: "CORREÇÃO", d: "Corrigir dados incompletos, errados ou desatualizados." },
  {
    t: "ANONIMIZAÇÃO OU BLOQUEIO",
    d: "De dados desnecessários ou tratados em desacordo com a lei.",
  },
  { t: "ELIMINAÇÃO", d: "Apagar dados tratados com base no seu consentimento." },
  { t: "PORTABILIDADE", d: "Levar seus dados para outro fornecedor." },
  { t: "COMPARTILHAMENTO", d: "Saber com quem compartilhamos seus dados." },
  { t: "REVOGAR CONSENTIMENTO", d: 'Retirar o "sim" que você deu, quando quiser.' },
  { t: "OPOSIÇÃO", d: "Se opor a um tratamento que não esteja de acordo com a lei." },
] as const;

/** The eight LGPD art. 18 rights, as in the privacy draft. */
export function RightsGrid() {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0">
      {RIGHTS.map((r) => (
        <li key={r.t} className="flex flex-col gap-2 border-[3px] border-border p-4">
          <span className="font-pixel text-[9px] leading-relaxed text-accent">{r.t}</span>
          <span className="text-[13px] leading-normal text-text-muted">{r.d}</span>
        </li>
      ))}
    </ul>
  );
}

/** Table frame that scrolls sideways on narrow screens. */
export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-[3px] border-border">
      {/* The scroll frame must be keyboard reachable (axe: scrollable-region-focusable). */}
      <table
        tabIndex={0}
        className={cn(
          "w-full min-w-[560px] border-collapse [&_td]:border-b-2 [&_td]:border-border-soft [&_td]:px-3.5 [&_td]:py-3 [&_td]:text-left [&_td]:align-top [&_td]:text-sm [&_td]:leading-normal [&_td]:text-text-muted [&_th]:border-b-2 [&_th]:border-border-soft [&_th]:bg-surface [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-left [&_th]:align-top [&_th]:font-pixel [&_th]:text-[9px] [&_th]:leading-normal [&_th]:font-normal [&_th]:text-yellow",
          focusRing,
        )}
      >
        {children}
      </table>
    </div>
  );
}

/** Styles for the elements markdown produces (JSX tags such as th/td are styled by DataTable). */
export const proseComponents: MDXComponents = {
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p {...props} className="m-0 text-[15px] leading-[1.7] text-text-muted" />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul {...props} className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-text-muted" />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol {...props} className="m-0 flex list-decimal flex-col gap-1.5 pl-[22px] text-text-muted" />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li {...props} className="text-[15px] leading-[1.7]" />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong {...props} className="font-bold text-text" />
  ),
  a: ({ href = "", ...rest }: ComponentPropsWithoutRef<"a">) =>
    href.startsWith("/") ? (
      <Link href={href} {...rest} className={legalLink} />
    ) : (
      <a href={href} {...rest} className={legalLink} />
    ),
};
