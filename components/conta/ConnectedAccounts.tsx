"use client";

import { useState, useTransition } from "react";
import { connectProviderAction, disconnectProviderAction } from "@/app/(conta)/conta/actions";
import { FormMessage } from "@/components/ui/FormMessage";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { AuthProvider, Connection } from "@/lib/data/ports";
import type { FormState } from "@/lib/validation/form-state";
import { dashedBlock, subTitle } from "./styles";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

const PROVIDERS: { id: AuthProvider; name: string; letter: string }[] = [
  { id: "google", name: "Google", letter: "G" },
  { id: "facebook", name: "Facebook", letter: "f" },
  { id: "apple", name: "Apple", letter: "A" },
];

type Props = { connections: Connection[]; authApple: boolean };

/** "CONTAS CONECTADAS": link or unlink Google, Facebook and (when enabled) Apple. */
export function ConnectedAccounts({ connections, authApple }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (provider: AuthProvider, connected: boolean) => {
    setMessage(null);
    startTransition(async () => {
      let result: FormState;
      try {
        result = connected
          ? await disconnectProviderAction(provider)
          : await connectProviderAction(provider);
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      setMessage({ ok: result.status === "ok", text: result.message ?? "" });
    });
  };

  return (
    <section id="contas-conectadas" className={cn(dashedBlock, "scroll-mt-4 gap-3")}>
      <h3 className={subTitle}>CONTAS CONECTADAS</h3>
      <p className="m-0 text-[13px] text-text-subtle">
        Use uma rede social para entrar sem senha. Você pode desconectar quando quiser.
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {PROVIDERS.filter((p) => authApple || p.id !== "apple").map((p) => {
          const link = connections.find((c) => c.provider === p.id);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border-soft py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center bg-text font-pixel text-xs text-bg"
                >
                  {p.letter}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px]">{p.name}</span>
                  <span className="text-xs text-text-subtle">
                    {link ? `Conectada · ${link.email ?? ""}` : "Não conectada"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                aria-label={`${link ? "Desconectar" : "Conectar"} ${p.name}`}
                onClick={() => toggle(p.id, Boolean(link))}
                className={cn(
                  "min-h-11 cursor-pointer border-[3px] px-3.5 py-2.5 font-pixel text-[9px] disabled:opacity-60",
                  link ? "border-border text-text" : "border-text bg-text text-bg",
                  focusRing,
                )}
              >
                {link ? "DESCONECTAR" : "CONECTAR"}
              </button>
            </li>
          );
        })}
      </ul>
      <FormMessage
        success={message?.ok ? message.text : null}
        error={message?.ok === false ? message.text : null}
      />
    </section>
  );
}
