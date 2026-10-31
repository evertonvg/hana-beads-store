"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { changePasswordAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/account";
import type { FormState } from "@/lib/validation/form-state";
import { PasswordRules } from "./PasswordRules";
import { accountInput, dashedBlock, subTitle } from "./styles";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const FIELDS = ["current", "next", "confirm"] as const;
const EMPTY: ChangePasswordInput = { current: "", next: "", confirm: "" };

/** "ALTERAR SENHA": needs the current password; the new one follows the signup rules. */
export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });
  const next = useWatch({ control, name: "next" });

  const onSubmit = (values: ChangePasswordInput) => {
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await changePasswordAction(values);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok") {
        reset(EMPTY);
        setMessage({ ok: true, text: result.message ?? "Senha alterada." });
        return;
      }
      for (const name of FIELDS) {
        const text = result.fieldErrors?.[name];
        if (text) setError(name, { message: text });
      }
      setMessage({ ok: false, text: result.message ?? GENERIC_ERROR });
    });
  };

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className={dashedBlock}>
      <h3 className={subTitle}>ALTERAR SENHA</h3>
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Field label="Senha atual" plainLabel error={errors.current?.message}>
          <TextInput
            type="password"
            autoComplete="current-password"
            className={accountInput}
            {...register("current")}
          />
        </Field>
        <Field label="Nova senha" plainLabel error={errors.next?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            className={accountInput}
            {...register("next")}
          />
        </Field>
        <Field label="Confirmar nova senha" plainLabel error={errors.confirm?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            className={accountInput}
            {...register("confirm")}
          />
        </Field>
      </div>
      <PasswordRules password={next} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          aria-busy={pending}
          className="min-h-[52px] px-[22px] text-[11px]"
        >
          ALTERAR SENHA
        </Button>
        <FormMessage
          success={message?.ok ? message.text : null}
          error={message?.ok === false ? message.text : null}
        />
      </div>
    </form>
  );
}
