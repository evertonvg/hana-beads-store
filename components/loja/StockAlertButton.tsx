"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState, useId, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { stockAlertAction } from "@/app/(loja)/loja/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { focusRing } from "@/components/ui/focus";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/validation/form-state";
import { stockAlertSchema, type StockAlertInput } from "@/lib/validation/stock-alert";

type FormInput = z.input<typeof stockAlertSchema>;

type Props = {
  productId: string;
  loggedIn: boolean;
  /** The price, rendered by the server card, shown beside the button. */
  children: ReactNode;
};

const IDLE: FormState = { status: "idle" };

/**
 * "AVISE-ME" for a sold-out card. Signed in, one click confirms. Signed out, it opens a small
 * form with e-mail and an unchecked consent, validated here and again in the server action.
 */
export function StockAlertButton({ productId, loggedIn, children }: Props) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(stockAlertAction, IDLE);
  const [, startTransition] = useTransition();
  const done = state.status === "ok";

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, StockAlertInput>({
    resolver: zodResolver(stockAlertSchema),
    defaultValues: { email: "", consent: false },
  });

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("productId", productId);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    startTransition(() => formAction(data));
  };

  const onTrigger = () => {
    if (done || pending) return;
    if (loggedIn) send({});
    else setExpanded((open) => !open);
  };

  const serverErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5">
        {children}
        <button
          type="button"
          aria-expanded={loggedIn ? undefined : expanded && !done}
          aria-controls={loggedIn ? undefined : panelId}
          aria-disabled={done || pending}
          onClick={onTrigger}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center border-[3px] border-text bg-transparent px-2.5 py-2.5 font-pixel text-[8px] text-text",
            focusRing,
            "aria-disabled:cursor-default",
          )}
        >
          {done ? "AVISAREMOS ✓" : "AVISE-ME"}
        </button>
      </div>

      {loggedIn && !done ? (
        // Notice wording is pending owner/legal review (the design has no consent text).
        <p className="text-[11px] leading-normal text-text-subtle">
          Vamos avisar no seu e-mail quando voltar.{" "}
          <Link
            href="/privacidade"
            className={cn(
              "inline-flex min-h-11 items-center text-link underline underline-offset-4 hover:text-yellow",
              focusRing,
            )}
          >
            Política de Privacidade
          </Link>
        </p>
      ) : null}

      {!loggedIn && expanded && !done ? (
        <form
          id={panelId}
          noValidate
          onSubmit={(e) =>
            void handleSubmit((values) =>
              send({ email: values.email, consent: String(values.consent) }),
            )(e)
          }
          className="flex flex-col gap-2"
        >
          <Field label="Seu e-mail" hideLabel error={errors.email?.message ?? serverErrors?.email}>
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="text-sm"
              {...register("email")}
            />
          </Field>
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                name={field.name}
                checked={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                // Wording is pending owner/legal review (the design has no consent text).
                label={
                  <span className="text-xs">
                    Quero ser avisado por e-mail quando voltar.{" "}
                    <Link
                      href="/privacidade"
                      className={cn(
                        "inline-flex min-h-11 items-center text-link underline underline-offset-4 hover:text-yellow",
                        focusRing,
                      )}
                    >
                      Política de Privacidade
                    </Link>
                  </span>
                }
                error={errors.consent?.message ?? serverErrors?.consent}
              />
            )}
          />
          <Button type="submit" variant="yellow" size="sm" disabled={pending} aria-busy={pending}>
            CONFIRMAR
          </Button>
        </form>
      ) : null}

      <FormMessage
        success={state.status === "ok" ? state.message : null}
        error={state.status === "error" ? state.message : null}
        className="text-[11px] leading-normal"
        successClassName="text-text-subtle"
      />
    </>
  );
}
