"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { quoteShippingAction } from "@/app/(loja)/carrinho/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PillRadioGroup } from "@/components/ui/PillRadioGroup";
import type { ShippingQuote } from "@/lib/data/ports";
import { totalLabel } from "@/lib/format";

const ERROR_MESSAGE = {
  cep_invalido: "CEP inválido. Confira os 8 números.",
  cep_nao_atendido: "CEP não atendido.",
} as const;

const UNAVAILABLE = "Não foi possível calcular agora. Tente de novo.";

type Props = {
  cep: string;
  quotes: ShippingQuote[];
  selectedId: string | null;
  items: { productId: string; qty: number }[];
  onQuoted: (cep: string, quotes: ShippingQuote[]) => void;
  onSelect: (id: string) => void;
};

/** CEP field with "OK" and the shipping options returned for it. */
export function ShippingQuoteBox({ cep, quotes, selectedId, items, onQuoted, onSelect }: Props) {
  const [value, setValue] = useState(cep);
  const [error, setError] = useState<string | null>(null);
  const quote = useMutation({ mutationFn: quoteShippingAction });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    quote.mutate(
      { cep: value, items },
      {
        onSuccess: (result) => {
          if (Array.isArray(result)) {
            onQuoted(value, result);
          } else {
            setError(ERROR_MESSAGE[result.error]);
            onQuoted(value, []);
          }
        },
        onError: () => setError(UNAVAILABLE),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <form noValidate onSubmit={submit} className="flex flex-col gap-2">
        <Field label="CEP para o frete" error={error ?? undefined}>
          <div className="flex gap-2">
            <MaskedInput
              mask="cep"
              value={value}
              onAccept={setValue}
              placeholder="00000-000"
              autoComplete="postal-code"
              className="min-h-12 flex-1 md:min-h-11"
            />
            <Button
              type="submit"
              variant="secondary"
              aria-label="OK, calcular frete"
              aria-busy={quote.isPending}
              disabled={quote.isPending}
              className="min-h-12 bg-text px-4 text-[9px] text-bg md:min-h-11"
            >
              OK
            </Button>
          </div>
        </Field>
      </form>
      {quotes.length > 0 ? (
        <PillRadioGroup
          label="Opções de frete"
          value={selectedId ?? ""}
          onChange={onSelect}
          className="flex-col flex-nowrap"
          optionClassName="w-full"
          options={quotes.map((q) => ({
            value: q.id,
            label: q.service,
            note: `${q.carrier} · ${q.days} · ${totalLabel(q.priceCents)}`,
          }))}
        />
      ) : null}
    </div>
  );
}
