import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { contactLabel, getContact, type ContactChannel } from "@/lib/contact";
import type { OrderStatus, PaymentMethod } from "@/lib/data/types";
import type { ClientOrder } from "@/lib/order-view-model";

export const ORDER_FILTERS = ["todos", "andamento", "entregues", "cancelados"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];
export type OrderGroup = Exclude<OrderFilter, "todos">;

const Q_MAX = 80;

/** `?filtro=` and `?q=` of /conta/pedidos. */
export const ordersParsers = {
  filtro: parseAsStringLiteral(ORDER_FILTERS).withDefault("todos"),
  q: parseAsString.withDefault(""),
};
export const loadOrdersQuery = createLoader(ordersParsers);
export const clampQuery = (q: string) => q.trim().slice(0, Q_MAX);

export const ORDER_FILTER_NAMES: Record<OrderFilter, string> = {
  todos: "TODOS",
  andamento: "EM ANDAMENTO",
  entregues: "ENTREGUES",
  cancelados: "CANCELADOS",
};

/** Badge tone of a status; the same names as `Badge`. */
export type StatusTone = "yellow" | "green" | "cyan" | "accent" | "subtle";

type Step = 0 | 1 | 2 | 3 | 4;

type StatusRow = {
  label: string;
  /** Shorter label for the phone (the design words one status differently there). */
  shortLabel?: string;
  tone: StatusTone;
  group: OrderGroup;
  step: Step;
  /** Cancelled and refunded orders have no phases to show. */
  progress: boolean;
};

const STATUS: Record<OrderStatus, StatusRow> = {
  aguardando_aprovacao: {
    label: "AGUARDANDO APROVAÇÃO",
    shortLabel: "APROVAR DESENHO",
    tone: "yellow",
    group: "andamento",
    step: 0,
    progress: true,
  },
  aguardando_pagamento: {
    label: "AGUARDANDO PAGAMENTO",
    tone: "yellow",
    group: "andamento",
    step: 0,
    progress: true,
  },
  pago: { label: "PAGO", tone: "accent", group: "andamento", step: 1, progress: true },
  em_producao: {
    label: "EM PRODUÇÃO",
    tone: "accent",
    group: "andamento",
    step: 2,
    progress: true,
  },
  enviado: { label: "ENVIADO", tone: "cyan", group: "andamento", step: 3, progress: true },
  entregue: { label: "ENTREGUE", tone: "green", group: "entregues", step: 4, progress: true },
  cancelado: { label: "CANCELADO", tone: "subtle", group: "cancelados", step: 0, progress: false },
  reembolsado: {
    label: "REEMBOLSADO",
    tone: "subtle",
    group: "cancelados",
    step: 0,
    progress: false,
  },
};

export type OrderStatusView = {
  label: string;
  shortLabel: string;
  tone: StatusTone;
  /** CSS color of the status: the badge and the filled phases. */
  color: string;
  group: OrderGroup;
  step: Step;
  showProgress: boolean;
  action: { label: string; href: string };
};

/**
 * Everything the order screens show about a status. The single source of the status labels and
 * colors: the account screens read them from here.
 *
 * `productSlugs` maps a product id to its slug, for the "buy again" and "see product" links
 * (the shop when the order has no known product, e.g. a custom order).
 */
export function orderStatusView(
  o: ClientOrder,
  channel: ContactChannel = getContact(),
  productSlugs: Record<string, string> = {},
): OrderStatusView {
  const row = STATUS[o.status];
  const slug = o.items
    .map((i) => (i.productId ? productSlugs[i.productId] : undefined))
    .find(Boolean);
  const productHref = slug ? `/produto/${slug}` : "/loja";

  const actions: Record<OrderStatus, { label: string; href: string }> = {
    aguardando_aprovacao: { label: contactLabel("ver", channel), href: channel.href() },
    aguardando_pagamento: { label: "PAGAR", href: `/pedido/${o.id}/pagamento` },
    pago: { label: contactLabel("falar", channel), href: channel.href() },
    em_producao: { label: contactLabel("falar", channel), href: channel.href() },
    // No tracking URL yet: the anchor is the tracking line of the open details.
    enviado: { label: "RASTREAR", href: `#rastreio-${o.id}` },
    entregue: { label: "COMPRAR DE NOVO", href: productHref },
    cancelado: { label: "VER PRODUTO", href: productHref },
    reembolsado: { label: "VER PRODUTO", href: productHref },
  };

  return {
    label: row.label,
    shortLabel: row.shortLabel ?? row.label,
    tone: row.tone,
    color: `var(--color-${row.tone === "subtle" ? "text-subtle" : row.tone})`,
    group: row.group,
    step: row.step,
    showProgress: row.progress,
    action: actions[o.status],
  };
}

const plain = (s: string) => s.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();

/** Orders of one filter whose number or item names contain `q` (accents and case ignored). */
export function filterOrders(orders: ClientOrder[], filter: OrderFilter, q: string): ClientOrder[] {
  const needle = plain(q.trim().replace(/^#/, ""));
  return orders.filter((o) => {
    if (filter !== "todos" && STATUS[o.status].group !== filter) return false;
    if (needle === "") return true;
    return o.number.includes(needle) || o.items.some((i) => plain(i.name).includes(needle));
  });
}

/** How many orders each filter shows (ignoring the search). */
export function filterCounts(orders: ClientOrder[]): Record<OrderFilter, number> {
  return {
    todos: orders.length,
    andamento: filterOrders(orders, "andamento", "").length,
    entregues: filterOrders(orders, "entregues", "").length,
    cancelados: filterOrders(orders, "cancelados", "").length,
  };
}

const METHOD: Record<PaymentMethod, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };

/** "Pix · aprovado": the payment line of the order details. */
export function paymentText(o: ClientOrder): string {
  if (o.status === "aguardando_aprovacao") return "Aguardando aprovação do desenho";
  const method = METHOD[o.paymentMethod];
  if (o.status === "aguardando_pagamento") return `${method} · aguardando pagamento`;
  if (o.status === "cancelado") return `${method} · não pago`;
  if (o.status === "reembolsado") return `${method} · reembolsado`;
  if (o.payment?.kind === "cartao") return `${method} · final ${o.payment.last4}`;
  return `${method} · aprovado`;
}

/** "2 itens", or the custom-order wording. */
export function itemsSummary(o: ClientOrder): string {
  if (o.isCustom) return "Encomenda personalizada";
  const n = o.items.reduce((sum, i) => sum + i.qty, 0);
  return `${n} ${n === 1 ? "item" : "itens"}`;
}

/** Shorter summary for the phone: "Garota Pixel + 1". */
export function itemsSummaryShort(o: ClientOrder): string {
  if (o.isCustom) return "Encomenda personalizada";
  const [first] = o.items;
  if (!first) return itemsSummary(o);
  return o.items.length === 1 ? first.name : `${first.name} + ${o.items.length - 1}`;
}

/** The hint line of a card. Dates the design leaves open stay placeholders. */
export function orderHint(o: ClientOrder, channel: ContactChannel = getContact()): string {
  switch (o.status) {
    case "aguardando_aprovacao":
      return `Enviamos o desenho no seu ${channel.name} para você aprovar.`;
    case "aguardando_pagamento":
      return "Falta o pagamento para a gente começar.";
    case "pago":
      return "Pagamento aprovado. Já já começamos a produção.";
    case "em_producao":
      return "Previsão de envio: [00/00]";
    case "enviado":
      return "Chega até [00/00]";
    case "entregue":
      return "Entregue em [00/00/0000]";
    case "cancelado":
    case "reembolsado":
      return "Mudou de ideia? O item ainda está na loja.";
  }
}
