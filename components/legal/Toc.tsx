import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";

export type TocItem = { id: string; label: string };

/** In-page index: plain anchors to the section ids. */
export function Toc({ items }: { items: TocItem[] }) {
  return (
    <nav
      aria-label="Nesta página"
      className="flex w-full min-w-0 flex-col gap-1 border-[3px] border-border p-5 text-[13px] md:w-auto md:flex-[1_1_240px]"
    >
      <span className="pb-2 font-pixel text-[9px] text-yellow">ÍNDICE</span>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(
            "inline-flex min-h-11 items-center text-link underline-offset-4 hover:text-yellow hover:underline",
            focusRing,
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
