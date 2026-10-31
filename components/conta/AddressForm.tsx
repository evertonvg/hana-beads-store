"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { saveAddressAction } from "@/app/(conta)/conta/actions";
import { AddressFields } from "@/components/address/AddressFields";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import type { Address } from "@/lib/data/types";
import {
  addressSchema,
  type AddressFormInput,
  type AddressFormOutput,
} from "@/lib/validation/address";
import type { FormState } from "@/lib/validation/form-state";
import { accountInput } from "./styles";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const FIELDS = [
  "label",
  "cep",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const;

type Props = {
  /** The address being edited; null = a new one. */
  address: Address | null;
  onDone: (message: string) => void;
  onCancel: () => void;
};

/** Add or edit one address of the address book (CEP autofill shared with the checkout). */
export function AddressForm({ address, onDone, onCancel }: Props) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<AddressFormInput, unknown, AddressFormOutput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      ...(address?.id ? { id: address.id } : {}),
      label: address?.label ?? "",
      cep: address?.cep ?? "",
      street: address?.street ?? "",
      number: address?.number ?? "",
      complement: address?.complement ?? "",
      district: address?.district ?? "",
      city: address?.city ?? "",
      state: (address?.state ?? "") as AddressFormInput["state"],
      isDefault: address?.isDefault ?? false,
    },
  });

  const onSubmit = (values: AddressFormOutput) => {
    setFormError(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await saveAddressAction(values);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok") {
        onDone(result.message ?? "Endereço salvo.");
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
      aria-label={address ? "Editar endereço" : "Novo endereço"}
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="flex flex-col gap-4 border-[3px] border-border p-4 md:p-5"
    >
      <Field
        label="Apelido"
        plainLabel
        hint="Opcional. Ex.: Casa, Trabalho."
        error={errors.label?.message}
      >
        <TextInput maxLength={30} className={accountInput} {...register("label")} />
      </Field>
      <AddressFields
        control={control}
        register={register}
        setValue={setValue}
        errors={{
          cep: errors.cep?.message,
          street: errors.street?.message,
          number: errors.number?.message,
          complement: errors.complement?.message,
          district: errors.district?.message,
          city: errors.city?.message,
          state: errors.state?.message,
        }}
        inputClassName={accountInput}
      />
      <Controller
        control={control}
        name="isDefault"
        render={({ field }) => (
          <Checkbox
            name={field.name}
            checked={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            label="Usar como endereço principal"
          />
        )}
      />
      <FormMessage error={formError} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          aria-busy={pending}
          className="min-h-[52px] shadow-[5px_5px_0_var(--color-yellow)]"
        >
          SALVAR ENDEREÇO
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="min-h-[52px] px-[22px] text-[11px]"
        >
          CANCELAR
        </Button>
      </div>
    </form>
  );
}
