"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { ContactButton } from "@/components/contact/ContactButton";
import { Badge } from "@/components/ui/Badge";
import { focusRing } from "@/components/ui/focus";
import { OrderProgress } from "@/components/ui/OrderProgress";
import { cn } from "@/lib/cn";
import { getContact } from "@/lib/contact";
import type { ClientOrder } from "@/lib/order-view-model";
import { formatDate, formatOrderNumber, priceLabel, totalLabel } from "@/lib/format";
import {
  itemsSummary,
  itemsSummaryShort,
  orderHint,
  orderStatusView,
  paymentText,
} from "@/lib/orders-view";

type Props = {
  order: ClientOrder;
  /** Product id -> slug, for "buy again". */
  productSlugs: Record<string, string>;
  defaultOpen?: boolean;
};

const EMPTY = "#2C2840";
const heading = "m-0 font-pixel text-[9px] leading-normal text-yellow";
const actionLink =
  "inline-flex min-h-11 items-center justify-center bg-text px-3 text-center font-pixel text-[9px] text-bg md:text-[8px]";
const detailLink =
  "inline-flex min-h-11 items-center text-[13px] text-link underline underline-offset-4 hover:text-yellow";

function Photos({ order, size }: { order: ClientOrder; size: 48 | 64 }) {
  const photos = order.items.flatMap((i) => (i.image ? [i.image] : []));
  const box = size === 64 ? "size-16" : "size-12";
  return (
    <>
      {photos.map((img, i) => (
        <Image
          key={`${img.url}-${i}`}
          src={img.url}
          alt={img.alt}
          width={size}
          height={size}
          className={cn(box, "flex-none border-2 border-text object-cover")}
        />
      ))}
      {photos.length === 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            box,
            "flex flex-none items-center justify-center border-2 border-dashed border-accent font-pixel text-accent",
            size === 64 ? "text-lg" : "text-sm",
          )}
        >
          ?
        </span>
      ) : null}
    </>
  );
}

/** One order of the history: summary, phases and expandable details. */
export function OrderCard({ order, productSlugs, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const channel = getContact();
  const view = orderStatusView(order, channel, productSlugs);
  const number = formatOrderNumber(order.number);
  const hint = orderHint(order, channel);
  const address = order.shippingAddress;
  const action = (
    <a href={view.action.href} className={actionLink}>
      {view.action.label}
    </a>
  );

  return (
    <article
      className={cn(
        "flex flex-col border-[3px] bg-surface",
        open ? "border-text" : "border-border",
      )}
    >
      {/* Phone: the whole summary is the toggle. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-3 bg-transparent p-3.5 text-left text-text md:hidden",
          focusRing,
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-pixel text-[9px]">{number}</span>
            {order.isCustom ? (
              <span className="border-2 border-text px-1 py-0.5 font-pixel text-[6px]">
                ENCOMENDA
              </span>
            ) : null}
          </span>
          <Badge tone={view.tone}>{view.shortLabel}</Badge>
        </span>
        <span className="flex items-center gap-2.5">
          <Photos order={order} size={48} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px]">{itemsSummaryShort(order)}</span>
            <span className="text-xs text-text-subtle">
              {formatDate(order.createdAt, "dd/MM")} · {totalLabel(order.totalCents)}
            </span>
          </span>
          <span aria-hidden="true" className="font-pixel text-[10px] text-accent">
            {open ? "▲" : "▼"}
          </span>
        </span>
        {view.showProgress ? (
          <span aria-hidden="true" className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-2"
                style={{ background: i < view.step ? view.color : EMPTY }}
              />
            ))}
          </span>
        ) : null}
      </button>

      {/* Computer: summary row, phases and a footer with the action and the toggle. */}
      <div className="hidden flex-col md:flex">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div className="flex flex-none gap-2">
            <Photos order={order} size={64} />
          </div>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="m-0 font-pixel text-xs">PEDIDO {number}</h2>
              {order.isCustom ? (
                <span className="border-2 border-text px-1.5 py-1 font-pixel text-[7px]">
                  ENCOMENDA
                </span>
              ) : null}
            </div>
            <span className="text-[13px] text-text-muted">
              {formatDate(order.createdAt)} · {itemsSummary(order)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <Badge tone={view.tone}>{view.label}</Badge>
            <span className="font-pixel text-[11px] text-yellow">
              {totalLabel(order.totalCents)}
            </span>
          </div>
        </div>
        {view.showProgress ? (
          <div className="px-5 pb-[18px]">
            <OrderProgress step={view.step} color={view.color} />
          </div>
        ) : (
          <p className="m-0 px-5 pb-[18px] text-[13px] text-text-muted">
            {order.status === "cancelado"
              ? "Pedido cancelado em [00/00/0000]. Reembolso: [status do reembolso]."
              : "Pedido reembolsado em [00/00/0000]."}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border-soft px-5 py-3.5">
          <span className="text-[13px] text-text-muted">{hint}</span>
          <div className="flex flex-wrap gap-2.5">
            {action}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              className={cn(
                "min-h-11 cursor-pointer border-[3px] border-text bg-transparent px-3 font-pixel text-[8px] text-text",
                focusRing,
              )}
              onClick={() => setOpen(!open)}
            >
              {open ? "FECHAR ▲" : "DETALHES ▼"}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          id={panelId}
          className="flex flex-col gap-5 border-t-[3px] border-dashed border-border bg-deep p-3.5 md:grid md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-6 md:px-5 md:py-[22px]"
        >
          <p className="m-0 text-[13px] text-text-muted md:hidden">{hint}</p>
          <section aria-label="Itens" className="flex flex-col gap-2.5">
            <h3 className={heading}>ITENS</h3>
            {order.items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.name} ×{item.qty}
                </span>
                <span className="text-text-muted">
                  {priceLabel(item.unitPriceCents === null ? null : item.unitPriceCents * item.qty)}
                </span>
              </div>
            ))}
            <dl className="m-0 flex flex-col gap-1.5 border-t-2 border-border-soft pt-2.5 text-[13px] text-text-muted">
              <div className="flex justify-between">
                <dt>Frete</dt>
                <dd className="m-0">{totalLabel(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between font-bold text-text">
                <dt>Total</dt>
                <dd className="m-0">{totalLabel(order.totalCents)}</dd>
              </div>
            </dl>
          </section>
          <section aria-label="Entrega" className="flex flex-col gap-2.5">
            <h3 className={heading}>ENTREGA</h3>
            <p className="m-0 text-sm leading-relaxed">
              {address.street}, {address.number}
              {address.complement ? ` - ${address.complement}` : ""}
              <br />
              {address.district} · {address.city}/{address.state}
              <br />
              {address.cep}
            </p>
            <p id={`rastreio-${order.id}`} className="m-0 text-[13px] text-text-muted">
              Rastreio:{" "}
              {order.trackingCode ?? (view.group === "andamento" ? "disponível após o envio" : "—")}
            </p>
          </section>
          <section aria-label="Pagamento e ajuda" className="flex flex-col items-start gap-2.5">
            <h3 className={heading}>PAGAMENTO</h3>
            <p className="m-0 text-sm">{paymentText(order)}</p>
            {/* No invoice exists yet: the design's link stays a placeholder until the fiscal flow does. */}
            <span className="text-[13px] text-text-subtle">Nota fiscal: [em breve]</span>
            <Link href={`/trocas?pedido=${order.id}`} className={detailLink}>
              Solicitar troca ou devolução
            </Link>
            <ContactButton kind="chamar" />
            <div className="w-full md:hidden [&>a]:flex">{action}</div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
