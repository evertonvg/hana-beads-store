import type { Metadata } from "next";
import { ChatExample } from "@/components/encomendas/ChatExample";
import { Checklist, SUGGESTED_TEXT } from "@/components/encomendas/Checklist";
import { Faq } from "@/components/encomendas/Faq";
import { OrderTypes } from "@/components/encomendas/OrderTypes";
import { Steps } from "@/components/encomendas/Steps";
import { ContactButton } from "@/components/contact/ContactButton";
import { Container } from "@/components/ui/Container";
import { getContact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Encomendas | Pixel Perfect Artesanato",
  description:
    "Chaveiros de pixel art personalizados: inicial, número, personagem ou pet. Conte sua ideia e a gente monta.",
};

export default function EncomendasPage() {
  const { name } = getContact();
  return (
    <>
      <Container className="flex flex-col items-center gap-10 py-10 md:flex-row md:flex-wrap md:gap-14 md:py-20">
        <div className="flex min-w-0 flex-col gap-6 md:flex-1 md:basis-[480px] md:gap-7">
          <p className="font-pixel text-[11px] text-yellow">▶ ENCOMENDAS ABERTAS</p>
          <h1 className="font-pixel text-xl leading-relaxed md:text-4xl md:leading-snug">
            TEM UMA IDEIA? <span className="text-accent">A GENTE MONTA.</span>
          </h1>
          <p className="max-w-[520px] text-base leading-relaxed text-text-muted md:text-lg">
            Inicial, número, seu personagem favorito, seu pet. Chama no {name}, conta o que você
            imaginou e a gente transforma em pixel art.
          </p>
          <div className="flex flex-col items-start">
            <ContactButton kind="chamar" size="lg" />
          </div>
          <p className="text-[13px] text-text-subtle">Atendimento: [dias e horários]</p>
        </div>
        <ChatExample />
      </Container>

      <Steps />
      <OrderTypes />

      <Container className="flex flex-col gap-8 pb-14 md:flex-row md:flex-wrap md:gap-8 md:pb-[88px]">
        <Checklist />
        <Faq />
      </Container>

      <section className="bg-accent text-bg">
        <Container className="flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center md:py-16">
          <h2 className="font-pixel text-base leading-normal md:text-xl">READY PLAYER YOU?</h2>
          <div className="flex flex-col">
            <ContactButton kind="encomendar" size="lg" message={SUGGESTED_TEXT} />
          </div>
        </Container>
      </section>
    </>
  );
}
