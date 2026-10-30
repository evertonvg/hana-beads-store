import Image from "next/image";
import { Container } from "@/components/ui/Container";

const TYPES = [
  {
    title: "INICIAIS E NÚMEROS",
    text: "Estrela, coração ou outra forma com a letra ou número que você quiser.",
    image: {
      src: "/img/produtos/estrela-numero-13.webp",
      alt: "Chaveiro de estrela vermelha com o número 13",
    },
  },
  {
    title: "PERSONAGENS",
    text: "Você em versão pixel, um personagem seu, as cores que preferir.",
    image: {
      src: "/img/produtos/garota-pixel.webp",
      alt: "Chaveiro de personagem em pixel art com cabelo rosa",
    },
  },
  {
    title: "SUA IDEIA",
    text: "Pet, comida, ícone, presente pra alguém. Conta pra gente que a gente avalia.",
    image: null,
  },
];

/** What can be ordered. The last card is the open "your idea" slot. */
export function OrderTypes() {
  return (
    <section aria-labelledby="tipos-title" className="py-14 md:py-[88px]">
      <Container className="flex flex-col gap-8 md:gap-10">
        <h2 id="tipos-title" className="font-pixel text-base leading-normal md:text-[22px]">
          O QUE DÁ PRA <span className="text-accent">ENCOMENDAR</span>
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((type) => (
            <article
              key={type.title}
              className={
                type.image
                  ? "flex flex-col border-[3px] border-border bg-surface"
                  : "flex flex-col border-[3px] border-dashed border-accent bg-surface"
              }
            >
              {type.image ? (
                <div className="relative h-[200px] md:h-60">
                  <Image
                    src={type.image.src}
                    alt={type.image.alt}
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-[200px] items-center justify-center font-pixel text-5xl text-accent md:h-60"
                >
                  ?
                </div>
              )}
              <div className="flex flex-col gap-2.5 p-5">
                <h3 className="font-pixel text-xs leading-relaxed">{type.title}</h3>
                <p className="text-sm leading-normal text-text-muted">{type.text}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
