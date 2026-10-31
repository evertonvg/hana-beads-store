import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrderCard } from "@/components/conta/OrderCard";
import { OrdersFilter } from "@/components/conta/OrdersFilter";
import { ProfileTabs } from "@/components/conta/ProfileTabs";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getData } from "@/lib/data";
import { clampQuery, filterCounts, filterOrders, loadOrdersQuery } from "@/lib/orders-view";
import { toClientOrder } from "@/lib/order-view-model";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Meus pedidos | Pixel Perfect Artesanato",
  robots: { index: false },
};

/** Placeholder with the page's height while the session and the orders load. */
function PedidosFallback() {
  return (
    <Container className="py-6 md:py-12">
      <div aria-hidden="true" className="min-h-[640px]" />
    </Container>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 border-[3px] border-dashed border-border px-6 py-12 text-center">
      <p className="m-0 font-pixel text-xs leading-normal">
        {filtered ? "NENHUM PEDIDO AQUI" : "NENHUMA PARTIDA AINDA"}
      </p>
      <p className="m-0 text-sm text-text-muted">
        {filtered
          ? "Nenhum pedido combina com esse filtro e essa busca."
          : "Quando você fizer um pedido, ele aparece aqui."}
      </p>
      <Button href={filtered ? "/conta/pedidos" : "/loja"} variant="primary" size="sm">
        {filtered ? "VER TODOS" : "IR PARA A LOJA"}
      </Button>
    </div>
  );
}

async function Loader({
  searchParams,
}: {
  searchParams: PageProps<"/conta/pedidos">["searchParams"];
}) {
  const query = await loadOrdersQuery(searchParams);
  const q = clampQuery(query.q);
  // A valid cookie of a deleted user has no session here: treat it as signed out.
  const user = await getSession().catch(() => null);
  if (!user) {
    const back = new URLSearchParams();
    if (query.filtro !== "todos") back.set("filtro", query.filtro);
    if (q !== "") back.set("q", q);
    const next = back.size > 0 ? `/conta/pedidos?${back}` : "/conta/pedidos";
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }

  const { orders, catalog } = getData();
  const all = (await orders.listForUser(user.id)).map(toClientOrder);
  const shown = filterOrders(all, query.filtro, q);
  const products = await catalog.byIds([
    ...new Set(all.flatMap((o) => o.items.flatMap((i) => (i.productId ? [i.productId] : [])))),
  ]);
  const productSlugs = Object.fromEntries(products.map((p) => [p.id, p.slug]));

  return (
    <Container className="flex flex-wrap items-start gap-8 py-6 md:py-12 md:pb-24">
      <ProfileTabs current="pedidos" />
      <section
        aria-labelledby="pedidos-titulo"
        className="flex w-full min-w-0 flex-col gap-6 md:w-auto md:flex-[999_1_640px]"
      >
        <Link
          href="/conta"
          aria-label="Voltar para minha conta"
          className={cn(
            "flex size-12 items-center justify-center border-[3px] border-border text-text md:hidden",
            focusRing,
          )}
        >
          <Icon name="chevron-left" size={22} />
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <p className="m-0 font-pixel text-[8px] text-yellow md:text-[10px]">
              HISTÓRICO DE PARTIDAS
            </p>
            <h1
              id="pedidos-titulo"
              className="m-0 font-pixel text-[13px] leading-snug md:text-[26px] md:leading-snug"
            >
              MEUS <span className="text-accent">PEDIDOS</span>
            </h1>
          </div>
          <OrdersFilter counts={filterCounts(all)} />
        </div>
        {shown.length === 0 ? (
          <Empty filtered={all.length > 0} />
        ) : (
          <div className="flex flex-col gap-3.5 md:gap-6">
            {shown.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                productSlugs={productSlugs}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}

export default function PedidosPage(props: PageProps<"/conta/pedidos">) {
  return (
    <Suspense fallback={<PedidosFallback />}>
      <Loader searchParams={props.searchParams} />
    </Suspense>
  );
}
