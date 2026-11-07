"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { loginAction, resendConfirmationAction, type AuthResult } from "@/app/(conta)/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { focusRing } from "@/components/ui/focus";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { authCard, authInput, textButton } from "./styles";
import { useFinishAuth } from "./use-finish-auth";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

type Props = { next: string; onForgot: () => void };

/**
 * E-mail + password sign-in. Server errors never say which of the two was wrong. An account not
 * confirmed yet (right password) gets "REENVIAR LINK" for a new confirmation e-mail.
 */
export function LoginForm({ next, onForgot }: Props) {
  const finish = useFinishAuth();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** E-mail of the unconfirmed account the resend button sends to (null = no button). */
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = (values: LoginInput) => {
    setFormError(null);
    setUnconfirmed(null);
    setResendMessage(null);
    setResendError(null);
    startTransition(async () => {
      let result: AuthResult;
      try {
        result = await loginAction({ ...values, next });
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok" && result.redirectTo) {
        setDone(true);
        await finish(result.redirectTo);
        return;
      }
      setFormError(result.message ?? GENERIC_ERROR);
      if (result.unconfirmed) setUnconfirmed(values.email);
      else setFocus("password");
    });
  };

  const resend = (email: string) => {
    setResendMessage(null);
    setResendError(null);
    startResend(async () => {
      try {
        const result = await resendConfirmationAction(email, next);
        if (result.status === "ok") setResendMessage(result.message ?? null);
        else setResendError(result.message ?? GENERIC_ERROR);
      } catch {
        setResendError(GENERIC_ERROR);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className={cn("flex flex-col gap-4 md:gap-[18px]", authCard)}
    >
      <Field label="E-mail" plainLabel error={errors.email?.message}>
        <TextInput type="email" autoComplete="email" className={authInput} {...register("email")} />
      </Field>
      <Field label="Senha" plainLabel error={errors.password?.message}>
        <div className="flex">
          <TextInput
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className={cn(authInput, "border-r-0")}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className={cn(
              "min-h-[52px] min-w-[76px] cursor-pointer border-[3px] border-border bg-bg px-3 font-pixel text-[8px] text-text md:min-h-12",
              focusRing,
            )}
          >
            {showPassword ? "OCULTAR" : "MOSTRAR"}
          </button>
        </div>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <Controller
          control={control}
          name="remember"
          render={({ field }) => (
            <Checkbox
              name={field.name}
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label="Manter conectado"
            />
          )}
        />
        <button type="button" onClick={onForgot} className={textButton}>
          Esqueci minha senha
        </button>
      </div>
      <FormMessage error={formError} />
      {unconfirmed ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => resend(unconfirmed)}
            disabled={resending}
            aria-busy={resending}
            className="min-h-12"
          >
            REENVIAR LINK
          </Button>
          <FormMessage success={resendMessage} error={resendError} />
        </div>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || done}
        aria-busy={pending}
        className="min-h-[52px] shadow-[4px_4px_0_var(--color-yellow)] md:shadow-[5px_5px_0_var(--color-yellow)]"
      >
        ENTRAR <span aria-hidden="true">›</span>
      </Button>
    </form>
  );
}
