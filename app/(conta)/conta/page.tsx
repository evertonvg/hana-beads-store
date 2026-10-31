import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AccountMenuMobile } from "@/components/conta/AccountMenuMobile";
import { AddressBook } from "@/components/conta/AddressBook";
import { ChangePasswordForm } from "@/components/conta/ChangePasswordForm";
import { ConnectedAccounts } from "@/components/conta/ConnectedAccounts";
import { ConsentSwitches } from "@/components/conta/ConsentSwitches";
import { DeleteAccount } from "@/components/conta/DeleteAccount";
import { OrdersPreview } from "@/components/conta/OrdersPreview";
import { PrivacyCards } from "@/components/conta/PrivacyCards";
import { ProfileForm } from "@/components/conta/ProfileForm";
import { parseTab, ProfileTabs, type AccountTab } from "@/components/conta/ProfileTabs";
import { focusRing } from "@/components/ui/focus";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";
import { getData } from "@/lib/data";
import type { ConsentRecord } from "@/lib/data/ports";
import { publicEnv } from "@/lib/env";
import { toClientOrder } from "@/lib/order-view-model";
import { getSession } from "@/lib/session";
import { panelTitle } from "@/components/conta/styles";

export const metadata: Metadata = {
  title: "Minha conta | Pixel Perfect Artesanato",
  robots: { index: false },
};

/** Marketing e-mail is on when the newest record of that type is a grant. */
function emailMarketingOn(records: ConsentRecord[]): boolean {
  const last = records.findLast((r) => r.type === "email_marketing");
  return last !== undefined && last.granted && last.revokedAt === null;
}

function Tab({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[22px]">
      <h2 className={panelTitle}>{title}</h2>
      {children}
    </div>
  );
}

/** Placeholder with the page's height: no inputs, so nothing can be typed into it. */
function ContaFallback() {
  return (
    <Container className="py-6 md:py-12">
      <div aria-hidden="true" className="min-h-[640px]" />
    </Container>
  );
}

async function Loader({ searchParams }: { searchParams: PageProps<"/conta">["searchParams"] }) {
  const aba = (await searchParams).aba;
  const tab = parseTab(aba);
  // A valid cookie of a deleted user has no session here: treat it as signed out.
  const user = await getSession().catch(() => null);
  const next = tab ? `/conta?aba=${tab}` : "/conta";
  if (!user) {
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }
  const current: AccountTab = tab ?? "dados";
  const { account, orders } = getData();

  // Only what the visible content needs; the phone menu (no `?aba`) also needs the last order.
  const profile = await account.profile(user.id);
  if (!profile) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const wants = (t: AccountTab) => current === t;
  const [connections, addresses, recent, consents] = await Promise.all([
    wants("dados") ? account.connections(user.id) : [],
    wants("enderecos") || tab === null ? account.addresses(user.id) : [],
    wants("pedidos") || tab === null ? orders.listForUser(user.id) : [],
    wants("privacidade") ? account.consents(user.id) : [],
  ]);
  const newestFirst = recent
    .map(toClientOrder)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Container className="flex flex-col gap-6 py-6 md:gap-9 md:pt-12 md:pb-24">
      <div className="flex items-center gap-3.5 md:gap-5">
        <div
          aria-hidden="true"
          className="flex size-16 flex-none items-center justify-center bg-accent font-pixel text-[22px] text-bg shadow-[4px_4px_0_var(--color-yellow)] md:size-[72px] md:text-2xl md:shadow-[5px_5px_0_var(--color-yellow)]"
        >
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 md:gap-2">
          <p className="m-0 font-pixel text-[8px] text-yellow md:text-[10px]">PLAYER 1</p>
          <h1 className="m-0 font-pixel text-xs leading-normal md:text-[22px] md:leading-snug">
            {profile.name}
          </h1>
          <p className="m-0 truncate text-xs text-text-subtle md:hidden">{profile.email}</p>
        </div>
      </div>

      {tab === null ? (
        <AccountMenuMobile lastOrder={newestFirst[0] ?? null} addressCount={addresses.length} />
      ) : (
        <Link
          href="/conta"
          className={cn(
            "inline-flex min-h-11 items-center self-start font-pixel text-[10px] text-link md:hidden",
            focusRing,
          )}
        >
          ‹ MINHA CONTA
        </Link>
      )}

      <div className="flex flex-wrap items-start gap-8">
        <ProfileTabs current={current} />
        <section
          className={cn(
            "min-w-0 flex-col gap-6 md:flex md:w-auto md:flex-[999_1_560px] md:border-[3px] md:border-border md:bg-surface md:p-8",
            tab === null ? "hidden" : "flex w-full",
          )}
        >
          {current === "dados" ? (
            <Tab title="MEUS DADOS">
              <ProfileForm profile={profile} />
              <ConnectedAccounts connections={connections} authApple={publicEnv.authApple} />
              <ChangePasswordForm />
            </Tab>
          ) : null}
          {current === "enderecos" ? (
            <Tab title="ENDEREÇOS">
              <AddressBook addresses={addresses} />
            </Tab>
          ) : null}
          {current === "pedidos" ? <OrdersPreview orders={newestFirst.slice(0, 2)} /> : null}
          {current === "privacidade" ? (
            <div className="flex flex-col gap-[26px]">
              <div className="flex flex-col gap-2.5">
                <h2 className={cn(panelTitle, "leading-normal")}>PRIVACIDADE E DADOS</h2>
                <p className="m-0 text-sm leading-relaxed text-text-muted">
                  Aqui você controla o que fazemos com seus dados, conforme a Lei Geral de Proteção
                  de Dados (LGPD).
                </p>
              </div>
              <ConsentSwitches emailMarketing={emailMarketingOn(consents)} />
              <PrivacyCards />
              <DeleteAccount />
            </div>
          ) : null}
        </section>
      </div>
    </Container>
  );
}

export default function ContaPage(props: PageProps<"/conta">) {
  return (
    <Suspense fallback={<ContaFallback />}>
      <Loader searchParams={props.searchParams} />
    </Suspense>
  );
}
