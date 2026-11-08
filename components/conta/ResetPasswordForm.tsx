"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  resetPasswordAction,
  type ResetPasswordResult,
} from "@/app/(conta)/redefinir-senha/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { TextInput } from "@/components/ui/TextInput";
import { GENERIC_ERROR } from "@/lib/validation/form-state";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/reset-password";
import { PasswordRules } from "./PasswordRules";
import { authInput } from "./styles";

const FIELDS = ["password", "confirmPassword"] as const;

/** New password + confirmation, with the live sign-up rules; success goes to /conta with a toast. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  useEffect(() => setFocus("password"), [setFocus]);

  const onSubmit = (values: ResetPasswordInput) => {
    setFormError(null);
    startTransition(async () => {
      let result: ResetPasswordResult;
      try {
        result = await resetPasswordAction(values);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok" && result.redirectTo) {
        setDone(true);
        toast.success(result.message ?? "Senha alterada.");
        router.push(result.redirectTo);
        router.refresh();
        return;
      }
      for (const name of FIELDS) {
        const text = result.fieldErrors?.[name];
        if (text) setError(name, { message: text });
      }
      setFormError(result.message ?? GENERIC_ERROR);
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-[18px] border-4 border-text bg-surface-2 p-5 shadow-[10px_10px_0_var(--color-accent)] md:p-7"
    >
      <Field label="Nova senha" plainLabel error={errors.password?.message}>
        <TextInput
          type="password"
          autoComplete="new-password"
          className={authInput}
          {...register("password")}
        />
      </Field>
      <Field label="Confirmar nova senha" plainLabel error={errors.confirmPassword?.message}>
        <TextInput
          type="password"
          autoComplete="new-password"
          className={authInput}
          {...register("confirmPassword")}
        />
      </Field>
      <PasswordRules password={password} />
      <FormMessage error={formError} />
      <Button
        type="submit"
        variant="primary"
        disabled={pending || done}
        aria-busy={pending}
        className="min-h-[52px] shadow-[5px_5px_0_var(--color-yellow)]"
      >
        SALVAR NOVA SENHA
      </Button>
    </form>
  );
}
