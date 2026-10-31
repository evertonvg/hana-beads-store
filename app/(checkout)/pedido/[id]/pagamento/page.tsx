import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BoletoPanel } from "@/components/checkout/BoletoPanel";
import { DeclinedPanel } from "@/components/checkout/DeclinedPanel";
import { PixPanel } from "@/components/checkout/PixPanel";
import { getData } from "@/lib/data";
import { toPaymentView } from "@/lib/order-view-model";
import { getOrderViewer } from "@/lib/order-viewer";
import { isPaidStatus } from "@/lib/order-status";
import { currentTimeMs } from "@/lib/pix-countdown";

/** Reads cookies to check ownership, so the route blocks instead of streaming (build requirement). */
export const instant = false;

export const metadata: Metadata = {
  title: "Pagamento | Pixel Perfect Artesanato",
  robots: { index: false },
};

/**
 * Missing and foreign orders both end in `notFound()`: the 404 screen (noindex), without a word
 * about the order. The status code stays 200 because Next has already sent the prerendered shell
 * (same limit as /produto/[slug]); the 404 status is only real on the status API route.
 */
export default async function PagamentoPage({ params }: PageProps<"/pedido/[id]/pagamento">) {
  const { id } = await params;
  const order = await getData().orders.get(id, await getOrderViewer());
  if (!order) notFound();
  if (isPaidStatus(order.status)) redirect(`/pedido/${order.id}/confirmado`);
  if (order.status !== "aguardando_pagamento") notFound();

  const { payment } = order;
  // Payment never started (e.g. the gateway failed during checkout): back to the checkout.
  if (!payment) redirect("/checkout");

  if (payment.kind === "pix") {
    return <PixPanel order={toPaymentView(order)} payment={payment} serverNow={currentTimeMs()} />;
  }
  if (payment.kind === "boleto")
    return <BoletoPanel order={toPaymentView(order)} payment={payment} />;
  if (payment.result === "recusado") return <DeclinedPanel orderId={order.id} />;
  // An approved card makes the order paid, which redirected above.
  notFound();
}
