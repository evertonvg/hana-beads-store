import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getContact } from "@/lib/contact";
import type { ClientOrder } from "@/lib/order-view-model";
import { formatOrderNumber } from "@/lib/format";
import { orderStatusView } from "@/lib/orders-view";
import { LogoutButton } from "./LogoutButton";

type Item = {
  icon: string;
  name: string;
  description: string;
  href: string;
  /** Opens another site (the help channel). */
  external?: boolean;
  color: string;
};

type Props = { lastOrder: ClientOrder | null; addressCount: number };

function items(addressCount: number): Item[] {
  const contact = getContact();
  return [
    {
      icon: "#",
      name: "Meus pedidos",
      description: "Acompanhe e rastreie",
      href: "/conta/pedidos",
      color: "text-accent",
    },
    {
      icon: "@",
      name: "Meus dados",
      description: "Nome, e-mail, celular, senha",
      href: "/conta?aba=dados",
      color: "text-yellow",
    },
    {
      icon: "⌂",
      name: "Endereços",
      description:
        addressCount === 0
          ? "Nenhum endereço salvo"
          : `${addressCount} ${addressCount === 1 ? "endereço salvo" : "endereços salvos"}`,
      href: "/conta?aba=enderecos",
      color: "text-cyan",
    },
    // "Favoritos" is left out until the favorites page exists (see docs/PENDENCIAS.md).
    {
      icon: "G",
      name: "Contas conectadas",
      description: "Google, Apple, Facebook",
      href: "/conta?aba=dados#contas-conectadas",
      color: "text-text",
    },
    {
      icon: "!",
      name: "Privacidade e dados",
      description: "Consentimentos, baixar ou excluir dados",
      href: "/conta?aba=privacidade",
      color: "text-green",
    },
    {
      icon: "↺",
      name: "Trocas e devoluções",
      description: "Solicitar ou acompanhar",
      href: "/trocas",
      color: "text-bead-orange",
    },
    {
      icon: "?",
      name: "Ajuda",
      description: `Fale com a gente pelo ${contact.name}`,
      href: contact.href(),
      external: true,
      color: "text-link",
    },
  ];
}

/** `/conta` on the phone: last order card and the list of account options. */
export function AccountMenuMobile({ lastOrder, addressCount }: Props) {
  const badge = lastOrder ? orderStatusView(lastOrder) : null;
  return (
    <div className="flex flex-col md:hidden">
      {lastOrder && badge ? (
        <Link
          href="/conta/pedidos"
          className={cn(
            "flex flex-col gap-3 border-[3px] border-text bg-surface-2 p-4 text-text shadow-[6px_6px_0_var(--color-accent)]",
            focusRing,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-[9px]">
              ÚLTIMO PEDIDO {formatOrderNumber(lastOrder.number)}
            </span>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <span className="text-xs text-text-muted">Ver detalhes ›</span>
        </Link>
      ) : null}

      <nav aria-label="Opções da conta" className="flex flex-col py-6">
        {items(addressCount).map((item) => (
          <Link
            key={item.name}
            href={item.href}
            {...(item.external ? { target: "_blank", rel: "noopener" } : {})}
            className={cn(
              "flex min-h-11 items-center gap-3.5 border-b-2 border-border-soft py-4 text-text",
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 flex-none items-center justify-center border-2 border-border font-pixel text-[9px]",
                item.color,
              )}
            >
              {item.icon}
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-[15px]">{item.name}</span>
              <span className="text-xs text-text-subtle">{item.description}</span>
            </span>
            <span aria-hidden="true" className="font-pixel text-[10px] text-accent">
              ›
            </span>
          </Link>
        ))}
      </nav>
      <LogoutButton className="min-h-[52px] border-[3px] border-border p-4 text-center font-pixel text-[10px] text-text">
        SAIR
      </LogoutButton>
    </div>
  );
}
