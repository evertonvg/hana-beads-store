import type { Order } from "@/lib/data/types";

/**
 * What a Client Component may receive about an order. `Pick<>` on a prop type is not enough:
 * props are serialized whole, so the server must build a smaller object. Anything personal
 * (CPF, e-mail, phone, the guest token, the owner id) stays out of the page payload.
 */
export type PaymentViewOrder = Pick<Order, "id" | "number" | "items" | "totalCents" | "status">;

export function toPaymentView(order: Order): PaymentViewOrder {
  return {
    id: order.id,
    number: order.number,
    items: order.items,
    totalCents: order.totalCents,
    status: order.status,
  };
}

/** An order as the account screens show it: the address and the card's last digits, no customer
 * (the Pix code and the boleto line are dropped from `payment`). */
export type ClientOrder = Omit<Order, "customer" | "guestToken" | "userId">;

export function toClientOrder(order: Order): ClientOrder {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentMethod: order.paymentMethod,
    items: order.items,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    shippingAddress: order.shippingAddress,
    shippingService: order.shippingService,
    trackingCode: order.trackingCode,
    isCustom: order.isCustom,
    createdAt: order.createdAt,
    events: order.events,
    payment: order.payment?.kind === "cartao" ? order.payment : null,
  };
}
