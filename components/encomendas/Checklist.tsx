import { ContactButton } from "@/components/contact/ContactButton";
import { SuggestedMessage } from "@/components/contact/SuggestedMessage";

const ITEMS = [
  "Foto ou descrição do que você quer",
  "Cores preferidas",
  "Quantidade de peças",
  "Data que você precisa receber",
];

export const SUGGESTED_TEXT = "Oi! Quero encomendar um chaveiro: [ideia], cores [ ], para [data]";

/** What to have at hand before contacting the shop, with the suggested first message. */
export function Checklist() {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-4 border-text bg-surface-2 p-6 shadow-[10px_10px_0_var(--color-accent)] md:flex-1 md:basis-[380px] md:p-7">
      <h2 className="font-pixel text-[13px] leading-relaxed text-yellow">
        ANTES DE CHAMAR, TENHA EM MÃOS
      </h2>
      <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-normal">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <SuggestedMessage text={SUGGESTED_TEXT} />
      <div className="flex flex-col">
        <ContactButton kind="encomendar" message={SUGGESTED_TEXT} />
      </div>
    </div>
  );
}
