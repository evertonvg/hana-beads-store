"use server";

import { getData } from "@/lib/data";
import type { Order } from "@/lib/data/types";
import { getOrderViewer } from "@/lib/order-viewer";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

export type PixRenewal =
  { status: "ok"; expiresAt: string; serverNow: number } | { status: "error"; message: string };

export type SwitchResult = { status: "ok" } | { status: "error"; message: string };

/** The order if the caller owns it and it still waits for payment; null otherwise. */
async function ownedOpenOrder(orderId: unknown): Promise<Order | null> {
  if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 80) return null;
  const order = await getData().orders.get(orderId, await getOrderViewer());
  return order?.status === "aguardando_pagamento" ? order : null;
}

/** New 30 minute Pix for an expired one. The cart is not touched. */
export async function renewPixAction(orderId: string): Promise<PixRenewal> {
  try {
    const order = await ownedOpenOrder(orderId);
    if (order?.payment?.kind !== "pix") return { status: "error", message: GENERIC_ERROR };
    const pix = await getData().payments.renewPix(order.id);
    return { status: "ok", expiresAt: pix.expiresAt, serverNow: Date.now() };
  } catch (error) {
    console.error("renewPixAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** Declined card or boleto: pay the same order with Pix instead. */
export async function switchToPixAction(orderId: string): Promise<SwitchResult> {
  try {
    const order = await ownedOpenOrder(orderId);
    if (!order) return { status: "error", message: GENERIC_ERROR };
    await getData().payments.start(order.id, "pix");
    return { status: "ok" };
  } catch (error) {
    console.error("switchToPixAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
