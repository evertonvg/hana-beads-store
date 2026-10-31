"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { signupAction, type AuthResult } from "@/app/(conta)/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { PasswordRules } from "./PasswordRules";
import { SocialButtons } from "./SocialButtons";
import { authCard, authInput, inlineLink } from "./styles";
import { useFinishAuth } from "./use-finish-auth";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

type SignupFormInput = z.input<typeof signupSchema>;

const FIELDS = ["name", "email", "phone", "password", "confirmPassword", "acceptTerms"] as const;

type Props = { next: string; authApple: boolean; className?: string };

/** "NEW PLAYER": social shortcuts and the e-mail form with live password rules and the consents. */
export function SignupForm({ next, authApple, className }: Props) {
  const finish = useFinishAuth();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormInput, unknown, SignupInput>({
    resolver: zodResolver(signupSchema),
    // Both consents start unchecked (LGPD): the user has to opt in.
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      marketingEmail: false,
    },
  });
  const password = useWatch({ control, name: "password" });
  const accepted = useWatch({ control, name: "acceptTerms" });

  const onSubmit = (values: SignupInput) => {
    setFormError(null);
    startTransition(async () => {
      let result: AuthResult;
      try {
        result = await signupAction({ ...values, next });
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok" && result.redirectTo) {
        setDone(true);
        await finish(result.redirectTo);
        return;
      }
      let placed = false;
      for (const name of FIELDS) {
        const message = result.fieldErrors?.[name];
        if (message) {
          setError(name, { message });
          placed = true;
        }
      }
      if (!placed) setFormError(result.message ?? GENERIC_ERROR);
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className={cn("flex min-w-0 flex-col gap-4 md:gap-5", authCard, "md:p-8", className)}
    >
      <div className="flex flex-col gap-3.5">
        <p className="hidden font-pixel text-[10px] text-yellow md:block">CADASTRO RÁPIDO</p>
        <SocialButtons next={next} apple={authApple} />
        <p className="text-xs leading-relaxed text-text-subtle">
          Ao continuar com uma rede social, você concorda com os{" "}
          <Link href="/termos" className={inlineLink}>
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className={inlineLink}>
            Política de Privacidade
          </Link>
          . Recebemos só nome, e-mail e foto de perfil.
        </p>
        <div
          aria-hidden="true"
          className="flex items-center gap-3 pt-1 font-pixel text-[8px] text-text-subtle md:text-[9px]"
        >
          <span className="h-[3px] flex-1 bg-border-soft md:bg-border" />
          OU COM E-MAIL
          <span className="h-[3px] flex-1 bg-border-soft md:bg-border" />
        </div>
      </div>

      <Field label="Nome completo" plainLabel error={errors.name?.message}>
        <TextInput autoComplete="name" className={authInput} {...register("name")} />
      </Field>
      <Field label="E-mail" plainLabel error={errors.email?.message}>
        <TextInput type="email" autoComplete="email" className={authInput} {...register("email")} />
      </Field>
      <Field label="Celular" plainLabel error={errors.phone?.message}>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <MaskedInput
              mask="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              className={authInput}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onAccept={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] md:gap-5">
        <Field label="Senha" plainLabel error={errors.password?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            className={authInput}
            {...register("password")}
          />
        </Field>
        <Field label="Confirmar senha" plainLabel error={errors.confirmPassword?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            className={authInput}
            {...register("confirmPassword")}
          />
        </Field>
      </div>
      <PasswordRules password={password} />

      <div className="flex flex-col gap-3 border-t-[3px] border-dashed border-border pt-4 md:pt-5">
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <Checkbox
              name={field.name}
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.acceptTerms?.message}
              label={
                <>
                  Li e concordo com os{" "}
                  <Link href="/termos" className={inlineLink}>
                    Termos de Uso
                  </Link>{" "}
                  e com a{" "}
                  <Link href="/privacidade" className={inlineLink}>
                    Política de Privacidade
                  </Link>
                  . <span className="text-yellow">(obrigatório)</span>
                </>
              }
            />
          )}
        />
        <Controller
          control={control}
          name="marketingEmail"
          render={({ field }) => (
            <Checkbox
              name={field.name}
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label={
                <>
                  Quero receber novidades e lançamentos por e-mail.{" "}
                  <span className="text-text-subtle">(opcional)</span>
                </>
              }
            />
          )}
        />
        <p className="text-xs leading-normal text-text-subtle">
          Você pode mudar essas escolhas a qualquer momento em Meu perfil › Privacidade.
        </p>
      </div>

      <FormMessage error={formError} />
      <Button
        type="submit"
        variant="primary"
        disabled={!accepted || pending || done}
        aria-busy={pending}
        className={cn(
          "min-h-14 shadow-[4px_4px_0_var(--color-yellow)] md:min-h-[52px] md:shadow-[5px_5px_0_var(--color-yellow)]",
          "disabled:border-[3px] disabled:border-border disabled:bg-surface disabled:text-text-subtle disabled:opacity-100 disabled:shadow-none",
        )}
      >
        CRIAR CONTA <span aria-hidden="true">›</span>
      </Button>
      <p className="hidden text-center text-sm md:block">
        Já tem conta?{" "}
        <Link href="/entrar" className={inlineLink}>
          Entrar
        </Link>
      </p>
    </form>
  );
}
