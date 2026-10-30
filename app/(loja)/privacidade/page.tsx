import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import Privacidade from "@/content/legal/privacidade.mdx";

export const metadata: Metadata = {
  title: "Política de Privacidade | Pixel Perfect Artesanato",
  description:
    "Quais dados pessoais coletamos, por que, com quem compartilhamos e como você controla tudo isso.",
};

const TOC = [
  { id: "quem", label: "1. Quem somos" },
  { id: "coletamos", label: "2. Dados que coletamos" },
  { id: "finalidades", label: "3. Para que usamos" },
  { id: "compartilhamento", label: "4. Com quem compartilhamos" },
  { id: "retencao", label: "5. Por quanto tempo guardamos" },
  { id: "direitos", label: "6. Seus direitos" },
  { id: "seguranca", label: "7. Segurança" },
  { id: "cookies", label: "8. Cookies" },
  { id: "menores", label: "9. Crianças e adolescentes" },
  { id: "contato", label: "10. Encarregado e contato" },
  { id: "mudancas", label: "11. Mudanças nesta política" },
];

const SUMMARY = [
  "Coletamos só o necessário para vender, entregar e atender você.",
  "Não vendemos nem alugamos seus dados.",
  'Marketing e cookies não essenciais só com o seu "sim".',
  "Você pode ver, corrigir, baixar ou excluir seus dados no seu perfil.",
];

export default function PrivacidadePage() {
  return (
    <LegalLayout
      kicker="LGPD · LEI Nº 13.709/2018"
      title="POLÍTICA DE PRIVACIDADE"
      lead="Explicamos aqui, sem juridiquês, quais dados pessoais coletamos, por que, com quem compartilhamos e como você controla tudo isso."
      updatedAt={null}
      summary={SUMMARY}
      toc={TOC}
    >
      <Privacidade />
    </LegalLayout>
  );
}
