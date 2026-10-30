import type { OrderStatus } from "@/lib/data/types";

/** Paid and everything after it: the buyer sees the confirmation screen. */
const PAID_OR_LATER: readonly OrderStatus[] = ["pago", "em_producao", "enviado", "entregue"];

export const isPaidStatus = (s: OrderStatus): boolean => PAID_OR_LATER.includes(s);

/** Nothing left to wait for on the payment screen: stop polling. */
export const isFinalStatus = (s: OrderStatus | undefined): boolean =>
  s !== undefined && s !== "aguardando_pagamento";
