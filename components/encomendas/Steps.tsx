import { Container } from "@/components/ui/Container";

const STEPS = [
  { title: "CONTA A IDEIA", text: "Manda uma foto de referência ou descreve o que quer." },
  {
    title: "APROVA O DESENHO",
    text: "A gente manda o risco em pixel e o orçamento. Ajusta até ficar do seu jeito.",
  },
  {
    title: "CONTA POR CONTA",
    text: "Com o pagamento confirmado, a peça entra na fila de produção.",
  },
  { title: "ITEM COLETADO!", text: "Foto da peça pronta e envio para sua casa." },
];

/** The four phases of a custom order. */
export function Steps() {
  return (
    <section
      aria-labelledby="fases-title"
      className="border-y-4 border-surface-2 bg-surface py-14 md:py-[88px]"
    >
      <Container className="flex flex-col gap-8 md:gap-11">
        <h2 id="fases-title" className="font-pixel text-base leading-normal md:text-[22px]">
          COMO FUNCIONA
        </h2>
        <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3.5 border-[3px] border-text p-6">
              <span className="font-pixel text-[10px] text-yellow">FASE {i + 1}</span>
              <h3 className="font-pixel text-xs leading-relaxed">{step.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
