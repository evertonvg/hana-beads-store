import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import Termos from "@/content/legal/termos.mdx";

export const metadata: Metadata = {
  title: "Termos de Uso | Pixel Perfect Artesanato",
  description: "As regras para usar o site, comprar e encomendar na Pixel Perfect Artesanato.",
};

const TOC = [
  { id: "t1", label: "1. Aceitação" },
  { id: "t2", label: "2. Quem somos" },
  { id: "t3", label: "3. Sua conta" },
  { id: "t4", label: "4. Produtos artesanais" },
  { id: "t5", label: "5. Preços e pagamento" },
  { id: "t6", label: "6. Encomendas personalizadas" },
  { id: "t7", label: "7. Entrega" },
  { id: "t8", label: "8. Trocas e devoluções" },
  { id: "t9", label: "9. Propriedade intelectual" },
  { id: "t10", label: "10. Responsabilidades" },
  { id: "t11", label: "11. Privacidade" },
  { id: "t12", label: "12. Mudanças e foro" },
];

export default function TermosPage() {
  return (
    <LegalLayout
      kicker="REGRAS DO JOGO"
      title="TERMOS DE USO"
      lead="As regras para usar o site, comprar e encomendar na Pixel Perfect Artesanato. Escrevemos do jeito mais claro possível."
      updatedAt={null}
      toc={TOC}
    >
      <Termos />
    </LegalLayout>
  );
}
