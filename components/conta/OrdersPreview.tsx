import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { Order } from "@/lib/data/types";
import { formatDate, formatOrderNumber } from "@/lib/format";
import { orderStatusView } from "@/lib/orders-view";
import { inlineLink, panelTitle } from "./styles";

const itemsText = (order: Order) => {
  const n = order.items.reduce((sum, i) => sum + i.qty, 0);
  return `${n} ${n === 1 ? "item" : "itens"}`;
};

/** "ÚLTIMOS PEDIDOS": the two newest orders, with a link to the full list. */
export function OrdersPreview({ orders }: { orders: Order[] }) {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={panelTitle}>ÚLTIMOS PEDIDOS</h2>
        <Link
          href="/conta/pedidos"
          className={cn(
            "inline-flex min-h-11 items-center bg-text px-3.5 font-pixel text-[9px] text-bg",
            focusRing,
          )}
        >
          VER TODOS ›
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">
          Você ainda não fez pedidos.{" "}
          <Link href="/loja" className={inlineLink}>
            Ver a loja
          </Link>
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[22px] p-0">
          {orders.map((order) => {
            const badge = orderStatusView(order);
            return (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3.5 border-[3px] border-border p-[18px]"
              >
                <div className="flex flex-col gap-2">
                  <span className="font-pixel text-[11px]">
                    PEDIDO {formatOrderNumber(order.number)}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {formatDate(order.createdAt)} · {itemsText(order)}
                  </span>
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <Link href="/conta/pedidos" className={cn(inlineLink, "text-sm")}>
                  Ver detalhes
                  <span className="sr-only"> do pedido {order.number}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
