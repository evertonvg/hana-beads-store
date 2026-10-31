import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/focus";
import Link from "next/link";

const slot = "h-14 border-[3px] border-dashed border-border md:h-[72px]";

type Props = {
  /** Shown when an item was just removed: puts it back. */
  onRestore: (() => void) | null;
  /** "COMECE POR AQUI" suggestions, rendered on the server. */
  suggestions: ReactNode;
};

/** "INVENTÁRIO VAZIO": empty slots, shop call to action and suggestions. */
export function CartEmpty({ onRestore, suggestions }: Props) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center gap-6 text-center md:gap-7 md:py-6">
        <div
          aria-hidden="true"
          className="grid grid-cols-[repeat(3,56px)] gap-2 md:grid-cols-[repeat(3,72px)] md:gap-2.5"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={cn(
                slot,
                i === 4 &&
                  "flex items-center justify-center border-accent font-pixel text-sm text-accent md:text-lg",
              )}
            >
              {i === 4 ? "?" : null}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <h2
            tabIndex={-1}
            data-focus-key="empty"
            className="m-0 font-pixel text-[15px] leading-normal outline-none md:text-xl"
          >
            INVENTÁRIO VAZIO
          </h2>
          <p className="m-0 max-w-[460px] text-[15px] leading-relaxed text-text-muted md:text-base">
            Nenhum item coletado ainda. Bora explorar a loja?
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-3.5">
          <Button
            href="/loja"
            variant="primary"
            className="shadow-[4px_4px_0_var(--color-yellow)] max-md:w-full md:px-[22px] md:py-[18px] md:shadow-[6px_6px_0_var(--color-yellow)]"
          >
            IR PARA A LOJA
          </Button>
          <Button href="/encomendas" variant="secondary" className="hidden md:inline-flex">
            ENCOMENDAR
          </Button>
        </div>
        <p className="m-0 text-[13px] text-text-subtle">
          Salvou itens em outro aparelho?{" "}
          <Link
            href="/entrar"
            className={cn(
              "inline-flex min-h-11 items-center text-link underline underline-offset-4 hover:text-yellow",
              focusRing,
            )}
          >
            Entre na sua conta
          </Link>
          .
        </p>
        {onRestore ? (
          <button
            type="button"
            onClick={onRestore}
            className={cn(
              "min-h-11 cursor-pointer text-[13px] text-text-subtle underline underline-offset-4",
              focusRing,
            )}
          >
            Desfazer remoção
          </button>
        ) : null}
      </div>
      {suggestions}
    </div>
  );
}
