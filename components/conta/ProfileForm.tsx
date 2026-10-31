"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { updateProfileAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { TextInput } from "@/components/ui/TextInput";
import type { Profile } from "@/lib/data/ports";
import { profileSchema, type ProfileInput } from "@/lib/validation/account";
import type { FormState } from "@/lib/validation/form-state";
import { accountInput, saveButtonClass } from "./styles";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const FIELDS = ["name", "phone", "cpf"] as const;

/** "Meus dados": name, e-mail (read only), phone and the optional CPF. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, phone: profile.phone, cpf: profile.cpf ?? "" },
  });

  const onSubmit = (values: ProfileInput) => {
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await updateProfileAction(values);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok") {
        setMessage({ ok: true, text: result.message ?? "Dados salvos." });
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
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-[22px]"
    >
      <div className="grid gap-[18px] md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        <Field label="Nome completo" plainLabel error={errors.name?.message}>
          <TextInput autoComplete="name" className={accountInput} {...register("name")} />
        </Field>
        <Field label="E-mail" plainLabel hint="O e-mail não pode ser alterado aqui.">
          <TextInput
            type="email"
            autoComplete="email"
            readOnly
            defaultValue={profile.email}
            className={accountInput}
          />
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
                className={accountInput}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onAccept={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
        <Field
          label="CPF"
          plainLabel
          hint="opcional · usado só para emitir nota fiscal"
          error={errors.cpf?.message}
        >
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <MaskedInput
                mask="cpf"
                placeholder="000.000.000-00"
                className={accountInput}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onAccept={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          aria-busy={pending}
          className={saveButtonClass}
        >
          SALVAR
        </Button>
        <FormMessage
          success={message?.ok ? message.text : null}
          error={message?.ok === false ? message.text : null}
        />
      </div>
    </form>
  );
}
