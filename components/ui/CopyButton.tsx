"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./focus";
import { useCopy } from "./useCopy";

type Props = {
  value: string;
  label?: string;
  copiedLabel?: string;
  resetMs?: number;
  /** Replaces the default look (a pixel-outlined button). Always keeps the focus ring. */
  className?: string;
  /** Extra classes while copied (e.g. the green background of the payment screens). */
  copiedClassName?: string;
  /** Decoration before the label (an `Icon`). */
  icon?: ReactNode;
};

const DEFAULT_LOOK =
  "min-h-11 cursor-pointer border-[3px] border-text px-3.5 py-3 font-pixel text-[9px] text-text";

/**
 * Copies `value` to the clipboard. A clipboard failure still swaps the label (as in the design).
 * The label change is not announced by itself, so a persistent `role="status"` region says it.
 */
export function CopyButton({
  value,
  label = "COPIAR",
  copiedLabel = "COPIADO ✓",
  resetMs,
  className,
  copiedClassName,
  icon,
}: Props) {
  const { copied, copy } = useCopy(value, resetMs);
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={cn(className ?? DEFAULT_LOOK, copied && copiedClassName, focusRing)}
      >
        {icon}
        {copied ? copiedLabel : label}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copiado para a área de transferência." : null}
      </span>
    </>
  );
}
