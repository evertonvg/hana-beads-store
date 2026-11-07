import { Button } from "@/components/ui/Button";
import { OrderProgress } from "@/components/ui/OrderProgress";
import type { Order } from "@/lib/data/types";
import { formatOrderNumber, totalLabel } from "@/lib/format";
import { ClearCartOnce } from "./ClearCartOnce";

type Props = {
  order: Pick<Order, "id" | "number" | "totalCents">;
  /** "Save my data" was asked at checkout: an account waits for its confirmation link. */
  accountPending?: boolean;
};

/** Order confirmed, "STAGE CLEAR!" (Sucesso.dc.html). Empties the cart once. */
export function ConfirmedPanel({ order, accountPending = false }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-8 px-4 pt-10 pb-24 text-center md:gap-9 md:px-6 md:pt-[88px]">
      <ClearCartOnce orderId={order.id} />
      <div aria-hidden="true" className="flex items-center gap-[18px] font-pixel">
        <span className="text-[28px] text-yellow">★</span>
        <span className="text-[40px] text-accent">★</span>
        <span className="text-[28px] text-yellow">★</span>
      </div>
      <h1 className="m-0 font-pixel text-[32px] leading-snug md:text-5xl md:leading-snug">
        STAGE
        <br />
        <span className="text-accent">CLEAR!</span>
      </h1>
      <p className="m-0 max-w-[560px] text-base leading-relaxed text-text-muted md:text-lg">
        Pedido recebido! Agora é com a gente: suas continhas já estão na fila de produção.
      </p>
      {accountPending ? (
        <p className="m-0 max-w-[560px] text-base leading-relaxed text-yellow">
          Enviamos um link para ativar sua conta.
        </p>
      ) : null}

      <section
        aria-label="Resumo do pedido"
        className="flex w-full flex-col gap-6 border-[3px] border-text bg-surface-2 p-[18px] text-left shadow-hard md:border-4 md:p-7 md:shadow-hard-lg"
      >
        <div className="flex flex-wrap justify-between gap-3 font-pixel text-[11px] leading-relaxed">
          <span>
            PEDIDO <span className="text-yellow">{formatOrderNumber(order.number)}</span>
          </span>
          <span className="text-text-muted">SCORE: {totalLabel(order.totalCents)}</span>
        </div>
        <div className="bg-bg p-3.5">
          <OrderProgress step={1} color="var(--color-accent)" />
        </div>
        <p className="m-0 text-sm leading-relaxed text-text-muted">
          Você vai receber uma foto da peça pronta por e-mail antes do envio. Prazo estimado: [X]
          dias úteis.
        </p>
      </section>

      <div className="flex flex-wrap justify-center gap-4">
        <Button href="/" variant="primary" size="lg">
          JOGAR DE NOVO
        </Button>
        <Button href="/conta/pedidos" variant="secondary" size="lg">
          ACOMPANHAR PEDIDO
        </Button>
      </div>
    </div>
  );
}
