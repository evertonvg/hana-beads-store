"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { createReturnAction } from "@/app/(loja)/trocas/actions";
import { Placeholder } from "@/components/legal/mdx";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PillRadioGroup } from "@/components/ui/PillRadioGroup";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { returnSchema, type ReturnInput } from "@/lib/validation/return";
import { PhotoPicker } from "./PhotoPicker";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const REASONS = [
  { value: "arrependimento", label: "Desisti da compra (até 7 dias)" },
  { value: "defeito", label: "Chegou com defeito" },
  { value: "diferente", label: "Veio diferente do pedido" },
  { value: "outro", label: "Outro motivo" },
] as const;

const PREFERENCES = [
  { value: "troca", label: "TROCA" },
  { value: "reembolso", label: "REEMBOLSO" },
  { value: "conserto", label: "CONSERTO" },
] as const;

const FIELDS = ["orderId", "reason", "description", "preference"] as const;

export type ReturnOrderOption = { id: string; label: string };

type Props = {
  orders: ReturnOrderOption[];
  /** Order to pre-select (`?pedido=`); the page only passes ids of the user's own orders. */
  defaultOrderId: string;
};

/** "SOLICITAR TROCA OU DEVOLUÇÃO" form and its "SOLICITAÇÃO ENVIADA" state. */
export function ReturnForm({ orders, defaultOrderId }: Props) {
  const [pending, startTransition] = useTransition();
  const [protocol, setProtocol] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const defaults: ReturnInput = {
    orderId: defaultOrderId,
    reason: "defeito",
    description: "",
    preference: "troca",
    photos: [],
  };
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ReturnInput>({ resolver: zodResolver(returnSchema), defaultValues: defaults });

  useEffect(() => {
    if (protocol) sentHeading.current?.focus();
  }, [protocol]);

  const onSubmit = (values: ReturnInput) => {
    setFormError(null);
    const body = new FormData();
    for (const name of FIELDS) body.set(name, values[name]);
    for (const photo of values.photos) body.append("photos", photo);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createReturnAction>>;
      try {
        result = await createReturnAction(body);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok") {
        setProtocol(result.protocol);
        return;
      }
      for (const [key, text] of Object.entries(result.fieldErrors ?? {})) {
        const name = key.startsWith("photos") ? "photos" : key;
        if (name === "photos" || (FIELDS as readonly string[]).includes(name)) {
          setError(name as keyof ReturnInput, { message: text });
        }
      }
      // A message that repeats a field error would only say it twice.
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  if (protocol) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span aria-hidden="true" className="text-green">
          <Icon name="check" size={36} />
        </span>
        <h2
          ref={sentHeading}
          tabIndex={-1}
          className="m-0 font-pixel text-sm leading-relaxed outline-none"
        >
          SOLICITAÇÃO ENVIADA
        </h2>
        <p className="m-0 text-[15px] leading-relaxed text-text-muted">
          Protocolo <strong>#{protocol}</strong>. Respondemos em até <Placeholder>[2]</Placeholder>{" "}
          dias úteis por e-mail com os próximos passos.
        </p>
        <Button href="/conta/pedidos" variant="secondary" size="sm" className="bg-text text-bg">
          VER MEUS PEDIDOS
        </Button>
        <button
          type="button"
          onClick={() => {
            reset(defaults);
            setFormError(null);
            setProtocol(null);
          }}
          className="min-h-11 cursor-pointer bg-transparent text-[13px] text-text-subtle underline outline-offset-2 outline-cyan focus-visible:outline-[3px]"
        >
          NOVA SOLICITAÇÃO
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-[18px]"
    >
      <h2 className="m-0 font-pixel text-[13px] leading-relaxed">SOLICITAR TROCA OU DEVOLUÇÃO</h2>

      <Field label="Pedido" plainLabel error={errors.orderId?.message}>
        <Select {...register("orderId")}>
          <option value="">Selecione o pedido</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="p-0 pb-2.5 text-sm">Motivo</legend>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <PillRadioGroup
              label="Motivo"
              value={field.value}
              onChange={field.onChange}
              options={[...REASONS]}
              className="flex-col"
              optionClassName="min-h-12 w-full items-start font-mono text-sm normal-case"
            />
          )}
        />
        {errors.reason?.message ? (
          <p role="alert" className="m-0 text-xs text-danger-text">
            {errors.reason.message}
          </p>
        ) : null}
      </fieldset>

      <Field label="Conte o que aconteceu" plainLabel error={errors.description?.message}>
        <Textarea rows={3} {...register("description")} />
      </Field>

      <Controller
        control={control}
        name="photos"
        render={({ field }) => (
          <PhotoPicker
            value={field.value}
            onChange={field.onChange}
            error={
              errors.photos?.message ??
              errors.photos?.root?.message ??
              firstPhotoError(errors.photos)
            }
          />
        )}
      />

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="p-0 pb-2.5 text-sm">Você prefere</legend>
        <Controller
          control={control}
          name="preference"
          render={({ field }) => (
            <PillRadioGroup
              label="Você prefere"
              value={field.value}
              onChange={field.onChange}
              options={[...PREFERENCES]}
            />
          )}
        />
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        aria-busy={pending}
        className="min-h-[52px] shadow-[5px_5px_0_var(--color-yellow)]"
      >
        ENVIAR SOLICITAÇÃO
      </Button>
      <FormMessage error={formError} />
    </form>
  );
}

/** Per-file errors come as an array of field errors; show the first message. */
function firstPhotoError(photos: unknown): string | undefined {
  if (!Array.isArray(photos)) return undefined;
  for (const item of photos as ({ message?: string } | undefined)[]) {
    if (item?.message) return item.message;
  }
  return undefined;
}
