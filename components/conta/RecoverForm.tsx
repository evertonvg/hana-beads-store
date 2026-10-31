"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { recoverAction } from "@/app/(conta)/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { recoverSchema, type RecoverInput } from "@/lib/validation/auth";
import { authInput, textButton } from "./styles";

type Props = { onSent: () => void; onBack: () => void };

/** "Esqueceu a senha?": the e-mail field. The confirmation never says whether the account exists. */
export function RecoverForm({ onSent, onBack }: Props) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<RecoverInput>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => setFocus("email"), [setFocus]);

  const onSubmit = (values: RecoverInput) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await recoverAction(values);
        if (result.status === "ok") {
          onSent();
          return;
        }
        if (result.fieldErrors?.email) {
          setError("email", { message: result.fieldErrors.email });
          return;
        }
        setFormError(result.message ?? null);
      } catch {
        setFormError("Não foi possível agora. Tente de novo.");
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-[18px] border-4 border-text bg-surface-2 p-5 shadow-[10px_10px_0_var(--color-accent)] md:p-7"
    >
      <Field label="E-mail cadastrado" plainLabel error={errors.email?.message}>
        <TextInput type="email" autoComplete="email" className={authInput} {...register("email")} />
      </Field>
      <FormMessage error={formError} />
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        aria-busy={pending}
        className="min-h-[52px] shadow-[5px_5px_0_var(--color-yellow)]"
      >
        ENVIAR LINK
      </Button>
      <button type="button" onClick={onBack} className={textButton}>
        ‹ Voltar para o login
      </button>
    </form>
  );
}
