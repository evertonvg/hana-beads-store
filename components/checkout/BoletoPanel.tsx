"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import { Button } from "@/components/ui/Button";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { BoletoPayment } from "@/lib/data/types";
import type { PaymentViewOrder } from "@/lib/order-view-model";
import { formatDate, formatOrderNumber, totalLabel } from "@/lib/format";
import { PaymentWaitNote } from "./PaymentWaitNote";
import { SwitchToPixButton } from "./SwitchToPixButton";
import { usePaymentStatus } from "./usePaymentStatus";

type Props = {
  order: Pick<PaymentViewOrder, "id" | "number" | "totalCents" | "status">;
  payment: BoletoPayment;
};

const PHASES = [
  { name: "Pedido feito", state: "done" },
  { name: "Pagamento", state: "current" },
  { name: "Produção", state: "todo" },
  { name: "Envio", state: "todo" },
] as const;

const fact = "flex flex-col gap-1.5";
const factLabel = "font-pixel text-[8px] text-text-subtle";
const factValue = "font-pixel text-xs";

/** Boleto screen, "JOGO PAUSADO" (Aguardando.dc.html). Polls until the boleto is paid. */
export function BoletoPanel({ order, payment }: Props) {
  const status = usePaymentStatus(order.id, order.status);

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-7 px-4 pt-8 pb-24 text-center md:gap-8 md:px-6 md:pt-[72px]">
      <div aria-hidden="true" className="flex gap-3.5">
        <span className="block h-14 w-4 bg-yellow md:h-[72px] md:w-[22px]" />
        <span className="block h-14 w-4 bg-yellow md:h-[72px] md:w-[22px]" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="m-0 font-pixel text-[9px] leading-relaxed text-yellow md:text-[10px]">
          PEDIDO {formatOrderNumber(order.number)} RESERVADO
        </p>
        <h1 className="m-0 font-pixel text-2xl leading-snug md:text-4xl md:leading-snug">
          JOGO <span className="text-yellow">PAUSADO</span>
        </h1>
        <p className="m-0 max-w-[580px] text-base leading-relaxed text-text-muted md:text-[17px]">
          Seu pedido está guardado. Assim que o pagamento for confirmado, as continhas entram na
          fila de produção.
        </p>
      </div>

      <section
        aria-label="Dados do boleto"
        className="flex w-full flex-col gap-[22px] border-[3px] border-text bg-surface-2 p-[18px] text-left shadow-hard md:border-4 md:p-7 md:shadow-hard-lg"
      >
        <dl className="m-0 flex flex-wrap justify-between gap-4">
          <div className={fact}>
            <dt className={factLabel}>FORMA</dt>
            <dd className={cn(factValue, "m-0")}>BOLETO</dd>
          </div>
          <div className={fact}>
            <dt className={factLabel}>VENCIMENTO</dt>
            <dd className={cn(factValue, "m-0")}>{formatDate(payment.dueDate)}</dd>
          </div>
          <div className={fact}>
            <dt className={factLabel}>VALOR</dt>
            <dd className={cn(factValue, "m-0 text-yellow")}>{totalLabel(order.totalCents)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="linha-boleto" className="font-pixel text-[9px] text-yellow">
            LINHA DIGITÁVEL
          </label>
          <div className="flex">
            <input
              id="linha-boleto"
              type="text"
              readOnly
              value={payment.line}
              className={cn(
                "min-h-[52px] min-w-0 flex-1 border-[3px] border-r-0 border-border bg-bg p-3 font-mono text-base text-text-muted md:text-sm",
                focusRing,
              )}
            />
            <CopyButton
              value={payment.line}
              className="min-h-[52px] min-w-[96px] cursor-pointer bg-text px-4 font-pixel text-[9px] text-bg md:min-w-[120px]"
              copiedClassName="bg-green"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          {payment.pdfUrl ? (
            <Button href={payment.pdfUrl} variant="primary">
              BAIXAR BOLETO (PDF)
            </Button>
          ) : (
            <Button variant="primary" disabled aria-describedby="boleto-pdf-nota">
              BAIXAR BOLETO (PDF)
            </Button>
          )}
          <SwitchToPixButton orderId={order.id} variant="secondary" />
        </div>
        {payment.pdfUrl ? null : (
          <p id="boleto-pdf-nota" className="m-0 text-[13px] text-text-subtle">
            [O PDF fica disponível quando o boleto for emitido pelo intermediador.]
          </p>
        )}

        <PaymentWaitNote
          wait={status.wait}
          waiting="Aguardando pagamento… A confirmação é automática e esta página atualiza sozinha."
        />

        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-sm leading-normal text-text-muted">
          <li>O boleto também foi enviado para o seu e-mail.</li>
          <li>A compensação pode levar até [3] dias úteis.</li>
          <li>
            Se não for pago até o vencimento, o pedido é cancelado e o item volta para a loja.
          </li>
        </ul>
      </section>

      <ol className="m-0 grid w-full list-none grid-cols-4 gap-2 p-0 text-left">
        {PHASES.map((phase) => (
          <li key={phase.name} className="flex flex-col gap-2">
            <div
              aria-hidden="true"
              className={cn(
                "h-2.5",
                phase.state === "done" && "bg-yellow",
                phase.state === "current" &&
                  "box-border border-2 border-dashed border-yellow bg-surface-2",
                phase.state === "todo" && "bg-surface-2",
              )}
            />
            <span
              className={cn(
                "text-xs",
                phase.state === "current" && "text-yellow",
                phase.state === "todo" && "text-phase-off-text",
              )}
            >
              {phase.name}
              {phase.state === "current" ? <span className="sr-only"> (etapa atual)</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Button
          href="/conta/pedidos"
          variant="secondary"
          size="sm"
          className="px-[18px] py-3.5 text-[10px]"
        >
          VER MEUS PEDIDOS
        </Button>
        <Button href="/loja" variant="ghost" size="sm" className="py-3.5 text-[10px] no-underline">
          VOLTAR PARA A LOJA
        </Button>
      </div>
    </div>
  );
}
