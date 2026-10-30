"use client";

import Link from "next/link";
import { debounce, useQueryStates } from "nuqs";
import { focusRing } from "@/components/ui/focus";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import {
  ORDER_FILTER_NAMES,
  ORDER_FILTERS,
  ordersParsers,
  type OrderFilter,
} from "@/lib/orders-view";

type Props = { counts: Record<OrderFilter, number> };

/** Search box and filter chips. Both live in the URL, so the server page renders the list. */
export function OrdersFilter({ counts }: Props) {
  const [{ filtro, q }, setQuery] = useQueryStates(ordersParsers, {
    shallow: false,
    history: "replace",
    scroll: false,
  });

  const hrefFor = (f: OrderFilter) => {
    const params = new URLSearchParams();
    if (f !== "todos") params.set("filtro", f);
    if (q !== "") params.set("q", q);
    const qs = params.toString();
    return qs === "" ? "/conta/pedidos" : `/conta/pedidos?${qs}`;
  };

  return (
    <>
      <div className="flex w-full flex-col gap-1.5 md:w-[280px]">
        <label htmlFor="busca-pedido" className="text-[13px] text-text-muted">
          Buscar por número ou produto
        </label>
        <TextInput
          id="busca-pedido"
          type="search"
          value={q}
          placeholder="#0000 ou estrela"
          maxLength={80}
          onChange={(e) => {
            const value = e.target.value;
            void setQuery({ q: value === "" ? null : value }, { limitUrlUpdates: debounce(300) });
          }}
          className="min-h-12 bg-bg text-base md:text-[15px]"
        />
      </div>
      <nav
        aria-label="Filtrar pedidos"
        className="order-last -mx-4 flex basis-full [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {ORDER_FILTERS.map((f) => {
          const active = f === filtro;
          return (
            <Link
              key={f}
              href={hrefFor(f)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 flex-none items-center border-[3px] px-3 font-pixel text-[8px] whitespace-nowrap md:px-3.5 md:text-[9px]",
                active ? "border-text bg-text text-bg" : "border-border text-text",
                focusRing,
              )}
            >
              {ORDER_FILTER_NAMES[f]} · {counts[f]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
