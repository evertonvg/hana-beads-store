import Image from "next/image";

/** Illustrative chat between a customer and the shop (static, not a real conversation). */
export function ChatExample() {
  return (
    <figure
      aria-label="Exemplo ilustrativo de conversa"
      className="m-0 flex w-full max-w-[460px] min-w-0 flex-col gap-3 md:flex-1 md:basis-[400px]"
    >
      <p className="max-w-[80%] self-end border-[3px] border-border bg-surface-2 px-4 py-3.5 text-[15px] leading-normal">
        Oi! Queria uma estrela com a letra R, dá pra fazer em rosa?
      </p>
      <p className="max-w-[80%] self-start bg-accent px-4 py-3.5 text-[15px] leading-normal font-bold text-bg">
        Dá sim! Te mando o desenho em pixel pra aprovar antes de montar.
      </p>
      <div className="w-[70%] self-start border-[3px] border-text bg-text p-2.5">
        <div className="relative h-[180px] md:h-[220px]">
          <Image
            src="/img/produtos/estrela-inicial-r.webp"
            alt="Chaveiro de estrela vermelha e rosa com a letra R"
            fill
            sizes="(min-width: 768px) 320px, 70vw"
            className="object-cover"
          />
        </div>
      </div>
      <p className="self-end border-[3px] border-border bg-surface-2 px-4 py-3.5 text-[15px]">
        Perfeito!!
      </p>
      <figcaption className="text-center text-xs text-text-subtle">
        Exemplo ilustrativo de conversa
      </figcaption>
    </figure>
  );
}
