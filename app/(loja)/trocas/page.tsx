import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnForm, type ReturnOrderOption } from "@/components/trocas/ReturnForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import Trocas from "@/content/legal/trocas.mdx";
import { getContact } from "@/lib/contact";
import { getData } from "@/lib/data";
import type { Order } from "@/lib/data/types";
import { formatDate, formatOrderNumber } from "@/lib/format";
import { getSession } from "@/lib/session";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Trocas e devoluções | Pixel Perfect Artesanato",
  description:
    "Como funcionam trocas e devoluções na Pixel Perfect Artesanato, e o formulário para solicitar.",
};

const HIGHLIGHTS = [
  {
    big: "7 DIAS",
    title: "ARREPENDIMENTO",
    text: "Desistiu da compra? Você tem 7 dias a partir do recebimento, sem precisar explicar o motivo.",
    color: "text-accent",
    shadow: "shadow-[8px_8px_0_var(--color-accent)]",
  },
  {
    big: "90 DIAS",
    title: "DEFEITO",
    text: "Conta soltou, argola quebrou ou veio diferente do pedido? Avise em até 90 dias.",
    color: "text-yellow",
    shadow: "shadow-[8px_8px_0_var(--color-yellow)]",
  },
  {
    big: "R$ 0",
    title: "FRETE DE VOLTA",
    text: "Nos casos de arrependimento e defeito, o frete de devolução é por nossa conta.",
    color: "text-cyan",
    shadow: "shadow-[8px_8px_0_var(--color-cyan)]",
  },
] as const;

const panel =
  "flex min-w-0 flex-col gap-5 border-4 border-text bg-surface p-6 shadow-[10px_10px_0_var(--color-accent)] md:flex-[1_1_380px] md:p-7";

/** The order line of the select: number, first item and where it is. */
function orderLabel(order: Order): string {
  const delivered = order.events.findLast((e) => e.status === "entregue")?.at;
  const where =
    order.status === "entregue"
      ? `entregue em ${formatDate(delivered ?? null, "dd/MM")}`
      : "enviado";
  const first = order.items[0]?.name ?? "Pedido";
  const more = order.items.length > 1 ? ` +${order.items.length - 1}` : "";
  return `${formatOrderNumber(order.number)} · ${first}${more} · ${where}`;
}

async function FormPanel({ searchParams }: { searchParams: PageProps<"/trocas">["searchParams"] }) {
  const pedido = (await searchParams).pedido;
  const wanted = typeof pedido === "string" && /^[\w-]{1,40}$/.test(pedido) ? pedido : null;
  const user = await getSession().catch(() => null);

  if (!user) {
    const next = wanted ? `/trocas?pedido=${wanted}` : "/trocas";
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="m-0 font-pixel text-[13px] leading-relaxed">ENTRE PARA SOLICITAR</h2>
        <p className="m-0 text-sm leading-relaxed text-text-muted">
          Para pedir troca ou devolução, entre na sua conta e escolha o pedido.
        </p>
        <Button href={`/entrar?next=${encodeURIComponent(next)}`} variant="primary" size="sm">
          ENTRAR
        </Button>
      </div>
    );
  }

  const orders = (await getData().orders.listForUser(user.id))
    .filter((o) => o.status === "enviado" || o.status === "entregue")
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const options: ReturnOrderOption[] = orders.map((o) => ({ id: o.id, label: orderLabel(o) }));

  if (options.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="m-0 font-pixel text-[13px] leading-relaxed">SOLICITAR TROCA OU DEVOLUÇÃO</h2>
        <p className="m-0 text-sm leading-relaxed text-text-muted">
          Você ainda não tem pedidos enviados ou entregues para trocar ou devolver.
        </p>
        <Button href="/loja" variant="secondary" size="sm">
          VER A LOJA
        </Button>
      </div>
    );
  }

  // Only the user's own orders can be pre-selected; anything else leaves the select empty.
  const defaultOrderId = options.find((o) => o.id === wanted)?.id ?? "";
  return <ReturnForm orders={options} defaultOrderId={defaultOrderId} />;
}

export default function TrocasPage({ searchParams }: PageProps<"/trocas">) {
  const channel = getContact();
  return (
    <>
      <Container className="flex flex-col gap-[18px] pt-10 pb-8 md:pt-14">
        <p className="font-pixel text-[10px] text-yellow">PÓS-VENDA</p>
        <h1 className="font-pixel text-xl leading-snug md:text-[30px] md:leading-[1.4]">
          TROCAS E <span className="text-accent">DEVOLUÇÕES</span>
        </h1>
        <p className="max-w-[760px] text-base leading-relaxed text-text-muted">
          Algo não saiu como esperado? A gente resolve. Veja abaixo como funciona e faça sua
          solicitação direto por aqui.
        </p>
      </Container>

      <Container className="pb-10">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px] p-0">
          {HIGHLIGHTS.map((h) => (
            <li
              key={h.title}
              className={cn(
                "flex flex-col gap-2.5 border-4 border-text bg-surface-2 p-[22px]",
                h.shadow,
              )}
            >
              <span className={cn("font-pixel text-[26px]", h.color)}>{h.big}</span>
              <span className="font-pixel text-[9px] leading-relaxed">{h.title}</span>
              <span className="text-sm leading-normal text-text-muted">{h.text}</span>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="flex flex-wrap items-start gap-8 pt-6 pb-16 md:gap-12 md:pb-24">
        <article className="flex min-w-0 flex-col gap-10 md:flex-[999_1_560px]">
          <Trocas />
        </article>
        <aside aria-label="Solicitar troca ou devolução" className={panel}>
          <Suspense fallback={<div aria-hidden="true" className="min-h-[560px]" />}>
            <FormPanel searchParams={searchParams} />
          </Suspense>
          <p className="m-0 border-t-[3px] border-dashed border-border pt-4 text-[13px] leading-relaxed text-text-subtle">
            Prefere conversar?{" "}
            <a
              href={channel.href()}
              target="_blank"
              rel="noopener"
              className={cn("text-link underline underline-offset-4 hover:text-yellow", focusRing)}
            >
              Chame no {channel.via}
            </a>{" "}
            com o número do pedido.
          </p>
        </aside>
      </Container>
    </>
  );
}
