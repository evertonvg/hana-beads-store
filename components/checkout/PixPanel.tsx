"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { renewPixAction } from "@/app/(checkout)/pedido/[id]/actions";
import { Button } from "@/components/ui/Button";
import { focusRing } from "@/components/ui/focus";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { PixQr } from "@/components/ui/PixQr";
import { cn } from "@/lib/cn";
import type { PixPayment } from "@/lib/data/types";
import type { PaymentViewOrder } from "@/lib/order-view-model";
import { formatOrderNumber, totalLabel } from "@/lib/format";
import { pixRemaining } from "@/lib/pix-countdown";
import { OrderAside } from "./OrderAside";
import { PaymentWaitNote } from "./PaymentWaitNote";
import { usePaymentStatus } from "./usePaymentStatus";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

type Props = {
  order: PaymentViewOrder;
  payment: PixPayment;
  /** Server time (ms) when the page was rendered: the countdown follows the server clock. */
  serverNow: number;
};

const STEPS_DESKTOP = [
  "Abra o app do seu banco e entre na área Pix.",
  "Escaneie o QR code ou use o Pix copia e cola.",
  "Confira o valor e o recebedor: Pixel Perfect Artesanato.",
];

/** Pix payment screen (Pix.dc.html on desktop, CelPix.dc.html on mobile). */
export function PixPanel({ order, payment: initialPayment, serverNow }: Props) {
  const [payment, setPayment] = useState(initialPayment);
  // Same value on the server and on the first client render; the clock takes over after mount.
  const [now, setNow] = useState(serverNow);
  // Server time minus browser time: keeps the countdown right even if the device clock is off.
  const skew = useRef(0);
  const [renewing, startRenew] = useTransition();
  const [renewError, setRenewError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const status = usePaymentStatus(order.id, order.status);

  useEffect(() => {
    skew.current = serverNow - Date.now();
    const tick = () => setNow(Date.now() + skew.current);
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [serverNow]);

  const remaining = pixRemaining(payment.expiresAt, now);
  const expired = remaining.seconds === 0;

  function renew() {
    setRenewError(null);
    startRenew(async () => {
      const result = await renewPixAction(order.id).catch(
        () => ({ status: "error", message: GENERIC_ERROR }) as const,
      );
      if (result.status !== "ok") {
        setRenewError(result.message);
        return;
      }
      skew.current = result.serverNow - Date.now();
      setNow(result.serverNow);
      setPayment((p) => ({ ...p, expiresAt: result.expiresAt }));
      setChecked(false);
    });
  }

  function alreadyPaid() {
    setChecking(true);
    void status.refetch().finally(() => {
      setChecking(false);
      setChecked(true);
    });
  }

  const timerColor = remaining.low ? "text-danger" : "text-green";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 pt-5 pb-24 md:gap-9 md:px-6 md:pt-12">
      <div className="flex flex-col gap-5">
        <ol className="m-0 hidden list-none flex-wrap gap-2 p-0 font-pixel text-[9px] text-bg md:flex">
          <li className="bg-yellow px-3.5 py-3">✓ 1 · DADOS</li>
          <li className="bg-yellow px-3.5 py-3">✓ 2 · ENTREGA</li>
          <li className="bg-accent px-3.5 py-3">3 · PAGAMENTO</li>
        </ol>
        <h1 className="font-pixel text-[13px] leading-normal md:text-[28px] md:leading-snug">
          PAGUE COM <span className="text-accent">PIX</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-start gap-5 md:gap-8">
        <section
          aria-label="Pagamento por Pix"
          className="flex min-w-0 flex-[999_1_600px] flex-col gap-[18px] md:flex-row md:flex-wrap md:items-start md:gap-9 md:border-4 md:border-text md:bg-surface-2 md:p-8 md:shadow-hard-lg"
        >
          <div
            className={cn(
              "mx-auto hidden flex-none flex-col items-center md:flex",
              expired && "opacity-40",
            )}
          >
            <PixQr value={payment.copyPaste} label="QR code do Pix" size={208} />
          </div>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px] md:gap-[22px]">
            <div className="flex flex-col gap-2.5 border-[3px] border-text bg-surface-2 p-4 md:border-0 md:bg-transparent md:p-0">
              <div className="flex items-center justify-between md:flex-col md:items-start md:gap-2.5">
                <span className="font-pixel text-[8px] text-yellow md:text-[9px]">
                  TEMPO RESTANTE
                </span>
                <span
                  data-testid="pix-timer"
                  className={cn("font-pixel text-lg md:text-[28px]", timerColor)}
                >
                  {remaining.label}
                </span>
              </div>
              <div className="h-2.5 bg-bg md:h-3.5 md:border-2 md:border-border">
                <div
                  className={cn("h-full", remaining.low ? "bg-danger" : "bg-green")}
                  style={{ width: `${(remaining.ratio * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="flex justify-between pt-1 text-[13px] md:hidden">
                <span>Pedido {formatOrderNumber(order.number)}</span>
                <span className="font-pixel text-[10px] text-yellow">
                  {totalLabel(order.totalCents)}
                </span>
              </div>
            </div>

            {expired ? (
              <div className="flex flex-col gap-3 border-[3px] border-danger p-4">
                <p role="status" className="m-0 text-sm leading-relaxed">
                  Este código Pix expirou. Gere outro: seu carrinho continua salvo.
                </p>
                <Button variant="primary" onClick={renew} disabled={renewing} aria-busy={renewing}>
                  GERAR NOVO PIX
                </Button>
                {renewError ? (
                  <p role="alert" className="m-0 text-[13px] text-danger-text">
                    {renewError}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="hidden flex-col gap-2.5 md:flex">
                  <label htmlFor="pix-codigo" className="font-pixel text-[9px] text-yellow">
                    PIX COPIA E COLA
                  </label>
                  <div className="flex">
                    <input
                      id="pix-codigo"
                      type="text"
                      readOnly
                      value={payment.copyPaste}
                      className={cn(
                        "min-h-[52px] min-w-0 flex-1 border-[3px] border-r-0 border-border bg-bg p-3 font-mono text-base text-text-muted md:text-[13px]",
                        focusRing,
                      )}
                    />
                    <CopyButton
                      value={payment.copyPaste}
                      className="min-h-[52px] min-w-[120px] cursor-pointer bg-text px-4 font-pixel text-[9px] text-bg"
                      copiedClassName="bg-green"
                    />
                  </div>
                </div>

                <CopyButton
                  value={payment.copyPaste}
                  label="COPIAR CÓDIGO PIX"
                  copiedLabel="CÓDIGO COPIADO ✓"
                  icon={<Icon name="copy" size={18} />}
                  className="flex min-h-[60px] cursor-pointer items-center justify-center gap-2.5 bg-accent font-pixel text-[11px] text-bg shadow-hard md:hidden"
                  copiedClassName="bg-green"
                />
                <p className="m-0 text-center text-[13px] leading-relaxed text-text-muted md:hidden">
                  Copie o código, abra o app do seu banco e escolha{" "}
                  <strong>Pix copia e cola</strong>.
                </p>

                <details className="border-[3px] border-border p-3.5 md:hidden">
                  <summary
                    className={cn(
                      "min-h-11 cursor-pointer font-pixel text-[9px] leading-relaxed",
                      focusRing,
                    )}
                  >
                    PAGAR EM OUTRO APARELHO? VER QR CODE
                  </summary>
                  <div className="flex flex-col items-center pt-4">
                    <PixQr value={payment.copyPaste} label="QR code do Pix" size={176} />
                  </div>
                </details>
              </>
            )}

            <ol className="m-0 hidden list-decimal flex-col gap-2 pl-[22px] text-sm leading-normal text-text-muted md:flex">
              {STEPS_DESKTOP.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-[22px] text-sm leading-normal text-text-muted md:hidden">
              <li>
                Toque em <strong>Copiar código Pix</strong>.
              </li>
              <li>No app do banco, cole o código na área Pix.</li>
              <li>Confira o recebedor: Pixel Perfect Artesanato.</li>
            </ol>

            <div className="flex flex-col gap-3.5 border-t-[3px] border-dashed border-border pt-4 md:pt-[18px]">
              <PaymentWaitNote
                wait={status.wait}
                waiting={`Aguardando pagamento… ${
                  checked
                    ? "Ainda não recebemos a confirmação do banco. Esta página atualiza sozinha."
                    : "A confirmação é automática e esta página atualiza sozinha."
                }`}
              />
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                <Button
                  variant="primary"
                  onClick={alreadyPaid}
                  disabled={checking}
                  className="max-md:border-[3px] max-md:border-text max-md:bg-transparent max-md:text-text max-md:shadow-none"
                >
                  JÁ PAGUEI
                </Button>
                <Button
                  href="/checkout"
                  variant="secondary"
                  className="max-md:border-0 max-md:font-mono max-md:text-sm max-md:text-link max-md:underline"
                >
                  TROCAR FORMA DE PAGAMENTO
                </Button>
              </div>
            </div>
          </div>
        </section>

        <OrderAside items={order.items} number={order.number} totalCents={order.totalCents} />
      </div>
    </div>
  );
}
