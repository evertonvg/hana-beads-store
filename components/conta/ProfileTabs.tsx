import Link from "next/link";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { LogoutButton } from "./LogoutButton";

export const ACCOUNT_TABS = [
  { id: "dados", name: "MEUS DADOS" },
  { id: "enderecos", name: "ENDEREÇOS" },
  { id: "pedidos", name: "PEDIDOS" },
  { id: "privacidade", name: "PRIVACIDADE E DADOS" },
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number]["id"];

/** Tab from the `?aba=` value; null when it is missing or unknown. */
export function parseTab(value: string | string[] | undefined): AccountTab | null {
  const v = Array.isArray(value) ? value[0] : value;
  return ACCOUNT_TABS.find((t) => t.id === v)?.id ?? null;
}

/** Side menu of "Minha conta" (desktop): one link per tab, the current one marked, and SAIR. */
export function ProfileTabs({ current }: { current: AccountTab }) {
  return (
    <nav
      aria-label="Minha conta"
      className="hidden flex-[1_1_240px] flex-col gap-2 md:flex md:max-w-[300px]"
    >
      {ACCOUNT_TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.id === "pedidos" ? "/conta/pedidos" : `/conta?aba=${tab.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] items-center border-[3px] p-4 font-pixel text-[10px] leading-normal",
              active ? "border-text bg-text text-bg" : "border-border text-text",
              focusRing,
            )}
          >
            {tab.name}
          </Link>
        );
      })}
      <LogoutButton className="min-h-11 p-4 text-left font-pixel text-[10px] text-text-muted">
        SAIR ›
      </LogoutButton>
    </nav>
  );
}
