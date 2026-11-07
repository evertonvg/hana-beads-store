"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { resendConfirmationAction } from "@/app/(conta)/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { cn } from "@/lib/cn";
import { GENERIC_ERROR } from "@/lib/validation/form-state";
import { textButton } from "./styles";

type Props = {
  /** Full e-mail, only sent back to the resend action. */
  email: string;
  /** What the screen shows (`a***@teste.dev`). */
  masked: string;
  /** Already sanitized by `safeNext` on the server. */
  next: string;
};

/**
 * "CONFIRA SEU E-MAIL" after sign-up: same card as the password-recovery "sent" state, with a
 * resend button (rate limited on the server, whose answer never says whether the account exists).
 */
export function ConfirmEmailNotice({ email, masked, next }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => heading.current?.focus(), []);

  const resend = () => {
    setSuccess(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await resendConfirmationAction(email, next);
        if (result.status === "ok") setSuccess(result.message ?? null);
        else setError(result.message ?? GENERIC_ERROR);
      } catch {
        setError(GENERIC_ERROR);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-[18px] border-4 border-text bg-surface-2 p-6 text-center shadow-[10px_10px_0_var(--color-accent)] md:p-8">
      <p aria-hidden="true" className="font-pixel text-[28px] text-yellow">
        ✉
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-pixel text-base leading-normal outline-none md:text-lg"
      >
        CONFIRA SEU E-MAIL
      </h1>
      <p className="text-[15px] leading-relaxed text-text-muted">
        Enviamos um link para <strong className="font-bold text-text">{masked}</strong>. Abra para
        ativar sua conta.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={resend}
        disabled={pending}
        aria-busy={pending}
        className="min-h-12"
      >
        REENVIAR LINK
      </Button>
      <FormMessage success={success} error={error} />
      <Link href="/entrar" className={cn(textButton, "inline-flex items-center")}>
        ‹ VOLTAR PARA ENTRAR
      </Link>
    </div>
  );
}
