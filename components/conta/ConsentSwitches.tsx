"use client";

import { useState, useTransition } from "react";
import { setMarketingConsentAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { Switch } from "@/components/ui/Switch";
import type { FormState } from "@/lib/validation/form-state";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

/** "COMUNICAÇÕES": optional consents. Each change is saved right away and kept in the history. */
export function ConsentSwitches({ emailMarketing }: { emailMarketing: boolean }) {
  const [on, setOn] = useState(emailMarketing);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const change = (value: boolean) => {
    setOn(value);
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = await setMarketingConsentAction(value);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      // Not saved: show the switch as it really is on the server.
      if (result.status !== "ok") setOn(!value);
      setMessage({ ok: result.status === "ok", text: result.message ?? "" });
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <h3 className="m-0 mb-2.5 font-pixel text-[10px] text-yellow">COMUNICAÇÕES</h3>
      <div className="border-b-2 border-border-soft">
        <Switch
          checked={on}
          disabled={pending}
          onCheckedChange={change}
          label="Novidades por e-mail"
          description="Lançamentos e promoções"
        />
      </div>
      <FormMessage
        success={message?.ok ? message.text : null}
        error={message?.ok === false ? message.text : null}
      />
      <p className="m-0 mt-2 text-xs text-text-subtle">
        E-mails sobre seus pedidos (confirmação, envio) continuam chegando, pois fazem parte da
        compra.
      </p>
    </div>
  );
}
