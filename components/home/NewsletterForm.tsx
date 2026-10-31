"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { subscribeNewsletter } from "@/app/(loja)/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { focusRing } from "@/components/ui/focus";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/validation/form-state";
import { newsletterSchema, type NewsletterInput } from "@/lib/validation/newsletter";

type NewsletterFormInput = z.input<typeof newsletterSchema>;

/** Newsletter signup: e-mail only, with an explicit, unchecked-by-default consent. */
export function NewsletterForm() {
  const [result, setResult] = useState<FormState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormInput, unknown, NewsletterInput>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "", consent: false },
  });

  const onSubmit = (values: NewsletterInput) => {
    setResult({ status: "idle" });
    startTransition(async () => {
      let state: FormState;
      try {
        state = await subscribeNewsletter(values);
      } catch {
        state = { status: "error", message: "Não foi possível agora. Tente de novo." };
      }
      setResult(state);
      if (state.status === "ok") {
        reset();
        return;
      }
      for (const [name, message] of Object.entries(state.fieldErrors ?? {})) {
        if (name === "email" || name === "consent") setError(name, { message });
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex w-full max-w-[520px] flex-col gap-3 text-left"
    >
      <div className="flex flex-col items-start gap-3 md:flex-row md:flex-wrap">
        <div className="w-full md:flex-1 md:basis-[260px]">
          <Field label="Seu e-mail" hideLabel error={errors.email?.message}>
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="min-h-[52px] border-text bg-surface md:min-h-11"
              {...register("email")}
            />
          </Field>
        </div>
        <Button
          type="submit"
          variant="yellow"
          disabled={pending}
          aria-busy={pending}
          className="min-h-[52px] w-full shadow-none md:min-h-11 md:w-auto"
        >
          YES!
        </Button>
      </div>
      <Controller
        control={control}
        name="consent"
        render={({ field }) => (
          <Checkbox
            name={field.name}
            checked={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            // Wording and consent version are pending owner/legal review (the design has no consent text).
            label={
              <>
                Quero receber novidades por e-mail.{" "}
                <Link
                  href="/privacidade"
                  className={cn(
                    "inline-flex min-h-11 items-center text-link underline underline-offset-4 hover:text-yellow",
                    focusRing,
                  )}
                >
                  Política de Privacidade
                </Link>
              </>
            }
            error={errors.consent?.message}
          />
        )}
      />
      <FormMessage
        success={result.status === "ok" ? result.message : null}
        error={result.status === "error" ? result.message : null}
        successClassName="font-bold text-green"
      />
    </form>
  );
}
