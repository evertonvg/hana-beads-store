import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Toc, type TocItem } from "./Toc";

type Props = {
  title: string;
  kicker?: string;
  /** Intro paragraph under the title. */
  lead?: string;
  /** Last update date; `null` while the draft has none (shows the `[00/00/0000]` placeholder). */
  updatedAt: string | null;
  /** Short key points shown in a highlighted box (privacy policy). */
  summary?: string[];
  toc: TocItem[];
  children: ReactNode;
};

/** Shared frame of the legal pages: heading block, optional summary, index and article. */
export function LegalLayout({ title, kicker, lead, updatedAt, summary, toc, children }: Props) {
  const words = title.split(" ");
  const last = words.pop();
  return (
    <>
      <Container className="flex flex-col gap-[18px] pt-10 pb-8 md:pt-14">
        {kicker ? <p className="font-pixel text-[10px] text-yellow">{kicker}</p> : null}
        <h1 className="font-pixel text-xl leading-snug md:text-[30px] md:leading-[1.4]">
          {words.join(" ")} <span className="text-accent">{last}</span>
        </h1>
        {lead ? (
          <p className="max-w-[760px] text-base leading-relaxed text-text-muted">{lead}</p>
        ) : null}
        <p className="text-[13px] text-text-subtle">
          Última atualização: {updatedAt ?? "[00/00/0000]"}
        </p>
      </Container>

      {summary ? (
        <Container className="pb-10">
          <ul
            aria-label="Resumo"
            className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 border-4 border-text bg-surface-2 p-6 shadow-[10px_10px_0_var(--color-accent)]"
          >
            {summary.map((text, i) => (
              <li key={text} className="flex flex-col gap-2">
                <span className="font-pixel text-[9px] text-yellow">RESUMO {i + 1}</span>
                <span className="text-sm leading-normal">{text}</span>
              </li>
            ))}
          </ul>
        </Container>
      ) : null}

      <Container className="flex flex-wrap items-start gap-8 pt-6 pb-16 md:gap-12 md:pb-24">
        <Toc items={toc} />
        <article className="flex min-w-0 flex-col gap-10 md:flex-[999_1_600px]">{children}</article>
      </Container>
    </>
  );
}
