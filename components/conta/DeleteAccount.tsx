"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { logoutAction } from "@/app/(conta)/actions";
import { deleteAccountAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Field } from "@/components/ui/Field";
import { focusRing } from "@/components/ui/focus";
import { TextInput } from "@/components/ui/TextInput";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { deleteAccountSchema, type DeleteAccountInput } from "@/lib/validation/account";
import type { FormState } from "@/lib/validation/form-state";
import { accountInput } from "./styles";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

/** "EXCLUIR MINHA CONTA": asks for the password, deletes, signs out and goes home with a notice. */
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  const trigger = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // The confirmation replaces the button: focus the password on open, give the button back on close.
  useEffect(() => {
    if (confirming) {
      opened.current = true;
      setFocus("password");
    } else if (opened.current) {
      opened.current = false;
      trigger.current?.focus();
    }
  }, [confirming, setFocus]);

  const onSubmit = (values: DeleteAccountInput) => {
    setFormError(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await deleteAccountAction(values);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status !== "ok") {
        const text = result.fieldErrors?.password;
        if (text) setError("password", { message: text });
        else setFormError(result.message ?? GENERIC_ERROR);
        return;
      }
      setDone(true);
      try {
        // The account is gone: sign out and drop the cart WITHOUT saving it first.
        await logoutAction();
      } catch {
        // The seal of a deleted user is already treated as signed out.
      }
      useCartStore.getState().release();
      toast.success("Conta excluída. Seus dados foram apagados.");
      router.push("/");
      router.refresh();
    });
  };

  const close = () => {
    reset();
    setFormError(null);
    setConfirming(false);
  };

  return (
    <div className="flex flex-col gap-3.5 border-[3px] border-danger p-[22px]">
      <h3 className="m-0 font-pixel text-[10px] text-danger-text">EXCLUIR MINHA CONTA</h3>
      <p className="m-0 text-sm leading-relaxed text-text-muted">
        Apagamos seu cadastro, endereços e preferências. Dados de pedidos e notas fiscais ficam
        guardados apenas pelo prazo exigido por lei.
      </p>
      {confirming ? (
        <form
          noValidate
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex flex-col gap-3.5 bg-surface-2 p-[18px]"
        >
          <p className="m-0 font-pixel text-[10px] leading-relaxed">
            GAME OVER DE VERDADE? ESSA AÇÃO NÃO PODE SER DESFEITA.
          </p>
          <Field
            label="Digite sua senha para confirmar"
            plainLabel
            error={errors.password?.message}
          >
            <TextInput
              type="password"
              autoComplete="current-password"
              className={accountInput}
              {...register("password")}
            />
          </Field>
          <FormMessage error={formError} />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending || done}
              aria-busy={pending}
              className={cn(
                "min-h-12 cursor-pointer bg-danger px-3.5 py-3.5 font-pixel text-[9px] text-bg disabled:opacity-60",
                focusRing,
              )}
            >
              SIM, EXCLUIR
            </button>
            <button
              type="button"
              disabled={pending || done}
              onClick={close}
              className={cn(
                "min-h-12 cursor-pointer border-[3px] border-text px-3.5 py-3 font-pixel text-[9px] text-text disabled:opacity-60",
                focusRing,
              )}
            >
              CANCELAR
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={trigger}
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            "min-h-12 cursor-pointer self-start border-[3px] border-danger bg-transparent px-3.5 py-3 font-pixel text-[9px] text-danger-text",
            focusRing,
          )}
        >
          EXCLUIR CONTA
        </button>
      )}
    </div>
  );
}
