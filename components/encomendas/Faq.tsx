import { Accordion } from "@/components/ui/Accordion";

const FAQ = [
  { id: "prazo", title: "QUANTO TEMPO DEMORA?", content: "[prazo] de produção das encomendas." },
  { id: "preco", title: "QUANTO CUSTA?", content: '[Faixa de preço ou "a partir de".]' },
  { id: "pagamento", title: "COMO PAGO?", content: "[Formas de pagamento aceitas.]" },
  {
    id: "quantidade",
    title: "FAZEM PEDIDOS EM QUANTIDADE?",
    content: "[Lembrancinhas, festas, eventos.]",
  },
];

/** Frequently asked questions; answers stay as placeholders until the shop provides them. */
export function Faq() {
  return (
    <div className="min-w-0 md:flex-[2] md:basis-[480px]">
      <h2 className="sr-only">Perguntas frequentes</h2>
      <Accordion items={FAQ} />
    </div>
  );
}
