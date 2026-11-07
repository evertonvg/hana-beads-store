import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfirmedPanel } from "@/components/checkout/ConfirmedPanel";
import { getData } from "@/lib/data";
import { getOrderViewer } from "@/lib/order-viewer";
import { isPaidStatus } from "@/lib/order-status";

/** Reads cookies to check ownership, so the route blocks instead of streaming (build requirement). */
export const instant = false;

export const metadata: Metadata = {
  title: "Pedido confirmado | Pixel Perfect Artesanato",
  robots: { index: false },
};

/** Only for paid orders (and later statuses); a pending one goes back to its payment screen. */
export default async function ConfirmadoPage({
  params,
  searchParams,
}: PageProps<"/pedido/[id]/confirmado">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getData().orders.get(id, await getOrderViewer());
  if (!order) notFound();
  if (order.status === "aguardando_pagamento") redirect(`/pedido/${order.id}/pagamento`);
  if (!isPaidStatus(order.status)) notFound();
  // Set by the checkout when "save my data" left an account pending e-mail confirmation.
  return <ConfirmedPanel order={order} accountPending={query.conta === "pendente"} />;
}
