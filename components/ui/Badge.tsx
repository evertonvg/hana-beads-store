import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva("inline-block px-2 py-1.5 font-pixel text-[7px] md:text-[8px]", {
  variants: {
    tone: {
      yellow: "bg-yellow text-bg",
      green: "bg-green text-bg",
      cyan: "bg-cyan text-bg",
      accent: "bg-accent text-bg",
      muted: "bg-surface-2 text-text-muted",
      subtle: "bg-text-subtle text-bg",
      purple: "bg-purple text-bg",
    },
  },
});

type Props = { tone: NonNullable<VariantProps<typeof badgeVariants>["tone"]>; children: ReactNode };

/** Small status label (stock, order status, tags). */
export function Badge({ tone, children }: Props) {
  return <span className={badgeVariants({ tone })}>{children}</span>;
}
