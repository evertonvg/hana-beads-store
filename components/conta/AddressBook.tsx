"use client";

import { useState, useTransition } from "react";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { Address } from "@/lib/data/types";
import type { FormState } from "@/lib/validation/form-state";
import { AddressForm } from "./AddressForm";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const linkButton = cn(
  "min-h-11 cursor-pointer bg-transparent p-0 text-sm underline disabled:opacity-60",
  focusRing,
);

/** Name used to tell addresses apart for assistive tech. */
const nameOf = (a: Address) => a.label || a.street;

function AddressCard({
  address,
  disabled,
  onEdit,
  onRemove,
  onMakeDefault,
}: {
  address: Address;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMakeDefault: () => void;
}) {
  const isDefault = Boolean(address.isDefault);
  const name = nameOf(address);
  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 border-[3px] p-5",
        isDefault ? "border-text" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        {isDefault ? (
          <span className="self-start bg-yellow px-2 py-1.5 font-pixel text-[8px] text-bg">
            PRINCIPAL
          </span>
        ) : null}
        {address.label ? <strong className="text-sm">{address.label}</strong> : null}
      </div>
      <p className="m-0 text-sm leading-relaxed">
        {address.street}, {address.number}
        {address.complement ? ` - ${address.complement}` : ""}
        <br />
        {address.district} · {address.city}/{address.state}
        <br />
        {address.cep}
      </p>
      <div className="flex flex-wrap gap-x-4">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Editar endereço ${name}`}
          onClick={onEdit}
          className={cn(linkButton, "text-link")}
        >
          Editar
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Remover endereço ${name}`}
          onClick={onRemove}
          className={cn(linkButton, "text-text-muted")}
        >
          Remover
        </button>
        {isDefault ? null : (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Tornar principal o endereço ${name}`}
            onClick={onMakeDefault}
            className={cn(linkButton, "text-link")}
          >
            Tornar principal
          </button>
        )}
      </div>
    </li>
  );
}

/** "ENDEREÇOS": the saved addresses with add, edit, remove and "make main". */
export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [pending, startTransition] = useTransition();
  // undefined = form closed; null = new address; otherwise the one being edited.
  const [editing, setEditing] = useState<Address | null | undefined>(undefined);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (work: () => Promise<FormState>) => {
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await work();
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      setMessage({ ok: result.status === "ok", text: result.message ?? "" });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {editing !== undefined ? (
        <AddressForm
          // A different address (or a new one) is a different form: start it clean.
          key={editing?.id ?? "new"}
          address={editing}
          onCancel={() => setEditing(undefined)}
          onDone={(text) => {
            setEditing(undefined);
            setMessage({ ok: true, text });
          }}
        />
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              disabled={pending}
              onEdit={() => setEditing(a)}
              onRemove={() => run(() => deleteAddressAction(a.id))}
              onMakeDefault={() => run(() => setDefaultAddressAction(a.id))}
            />
          ))}
          <li className="flex">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={cn(
                "min-h-40 w-full cursor-pointer border-[3px] border-dashed border-border bg-transparent font-pixel text-[10px] text-text",
                focusRing,
              )}
            >
              + NOVO ENDEREÇO
            </button>
          </li>
        </ul>
      )}
      <FormMessage
        success={message?.ok ? message.text : null}
        error={message?.ok === false ? message.text : null}
      />
    </div>
  );
}
