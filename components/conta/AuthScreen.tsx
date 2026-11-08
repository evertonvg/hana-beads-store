"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { AuthTabs, type AuthTab } from "./AuthTabs";
import { LoginForm } from "./LoginForm";
import { RecoverForm } from "./RecoverForm";
import { SignupForm } from "./SignupForm";
import { SocialButtons } from "./SocialButtons";
import { inlineLink } from "./styles";

export type AuthMode = "entrar" | "recuperar" | "enviado";

type Props = {
  initialTab: AuthTab;
  initialMode: AuthMode;
  /** Already sanitized by `safeNext` on the server. */
  next: string;
  authApple: boolean;
  /** An e-mail link or social sign-in failed (`/entrar?erro=link`): shown above the login. */
  linkError?: boolean;
};

const lgpd = (
  <p className="text-center text-xs leading-relaxed text-text-subtle">
    Seus dados são tratados conforme a LGPD. Veja nossa{" "}
    <Link href="/privacidade" className={inlineLink}>
      Política de Privacidade
    </Link>
    .
  </p>
);

function Divider({ className, children }: { className: string; children: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "items-center gap-3 font-pixel text-[8px] text-text-subtle md:text-[9px]",
        className,
      )}
    >
      <span className="h-[3px] flex-1 bg-border-soft" />
      {children}
      <span className="h-[3px] flex-1 bg-border-soft" />
    </div>
  );
}

function Sent({ onBack }: { onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="flex flex-col items-center gap-[18px] border-4 border-text bg-surface-2 p-6 text-center shadow-[10px_10px_0_var(--color-accent)] md:p-8">
      <p aria-hidden="true" className="font-pixel text-[28px] text-yellow">
        ✉
      </p>
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-pixel text-base leading-normal uppercase outline-none"
      >
        Confira seu e-mail
      </h1>
      <p className="text-[15px] leading-relaxed text-text-muted">
        Se o e-mail estiver cadastrado, você vai receber um link válido por [X] minutos. Olhe também
        a caixa de spam.
      </p>
      <Button type="button" variant="secondary" onClick={onBack} className="min-h-12">
        VOLTAR AO LOGIN
      </Button>
    </div>
  );
}

/**
 * The three access screens in one component so the mobile tabs can switch between sign-in and
 * sign-up without a navigation. From `md` it shows only the one the URL asked for (the tabs are
 * hidden): `/entrar` (login, password recovery) or `/cadastro` (sign-up).
 */
export function AuthScreen({ initialTab, initialMode, next, authApple, linkError }: Props) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const wrapper = cn(
    "mx-auto w-full px-4 pt-6 pb-10 md:px-6 md:pt-[72px] md:pb-24",
    tab === "criar" ? "max-w-[1100px]" : "max-w-[480px]",
  );

  if (tab === "entrar" && mode !== "entrar") {
    return (
      <div className={wrapper}>
        <div className="flex flex-col gap-7">
          {mode === "recuperar" ? (
            <>
              <div className="flex flex-col gap-3 text-center">
                <p className="font-pixel text-[10px] text-yellow">RECUPERAR ACESSO</p>
                <h1 className="font-pixel text-[18px] leading-snug md:text-[22px]">
                  ESQUECEU A SENHA?
                </h1>
                <p className="text-[15px] leading-relaxed text-text-muted">
                  Informe seu e-mail e enviaremos um link para criar uma nova senha.
                </p>
              </div>
              <RecoverForm onSent={() => setMode("enviado")} onBack={() => setMode("entrar")} />
            </>
          ) : (
            <Sent onBack={() => setMode("entrar")} />
          )}
          {lgpd}
        </div>
      </div>
    );
  }

  if (tab === "entrar") {
    return (
      <div className={wrapper}>
        <div className="flex flex-col gap-[22px] md:gap-7">
          <AuthTabs tab={tab} onChange={setTab} />
          <div className="order-2 flex flex-col gap-3 text-center">
            <p className="hidden font-pixel text-[10px] text-yellow md:block">CONTINUE?</p>
            <h1 className="font-pixel text-lg leading-normal md:text-[26px] md:leading-snug">
              PLAYER <span className="text-accent">LOGIN</span>
            </h1>
          </div>
          {linkError ? (
            <p
              role="alert"
              className="order-2 m-0 border-[3px] border-danger bg-bg p-3.5 text-center text-sm leading-relaxed text-danger-text"
            >
              Link inválido ou expirado. Peça um novo.
            </p>
          ) : null}
          <div className="order-3 flex flex-col gap-3.5 md:order-4">
            <Divider className="hidden md:flex">OU ENTRE COM</Divider>
            <SocialButtons next={next} apple={authApple} />
            <p className="text-center text-xs leading-normal text-text-subtle md:leading-relaxed">
              Recebemos só seu nome, e-mail e foto de perfil. Nunca publicamos nada nas suas redes.
            </p>
          </div>
          <Divider className="order-4 flex md:hidden">OU COM E-MAIL</Divider>
          <div className="order-5 md:order-3">
            <LoginForm next={next} onForgot={() => setMode("recuperar")} />
          </div>
          <div className="order-6 hidden flex-col items-center gap-3.5 border-[3px] border-dashed border-border p-[22px] text-center md:flex">
            <p className="font-pixel text-[10px]">NOVO POR AQUI?</p>
            <p className="text-sm text-text-muted">
              Crie sua conta para acompanhar pedidos e comprar mais rápido.
            </p>
            <Button href="/cadastro" variant="secondary" size="sm" className="min-h-12 text-[10px]">
              NEW PLAYER +
            </Button>
          </div>
          <div className="order-7">{lgpd}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div className="flex flex-col gap-[22px] md:flex-row md:flex-wrap md:items-start md:gap-12">
        <div className="flex flex-col gap-[22px] md:flex-[1_1_320px] md:gap-6">
          <div className="flex flex-col gap-[22px] md:hidden">
            <AuthTabs tab={tab} onChange={setTab} />
            <h1 className="order-2 text-center font-pixel text-lg leading-normal">
              NEW <span className="text-accent">PLAYER</span>
            </h1>
          </div>
          <div className="hidden flex-col gap-6 md:flex">
            <p className="font-pixel text-[10px] text-yellow">CRIAR CONTA</p>
            <h1 className="font-pixel text-[30px] leading-snug">
              NEW <span className="text-accent">PLAYER</span>
            </h1>
            <p className="text-base leading-relaxed text-text-muted">
              Com uma conta você acompanha seus pedidos, salva endereços e compra mais rápido.
            </p>
            <div className="flex flex-col gap-3.5 border-[3px] border-border p-[22px]">
              <h2 className="font-pixel text-[10px] leading-relaxed text-yellow">
                SEUS DADOS, SUAS REGRAS
              </h2>
              <ul className="m-0 flex list-disc flex-col gap-2.5 pl-[18px] text-sm leading-normal text-text-muted">
                <li>Pedimos só o necessário para vender e entregar.</li>
                <li>Não vendemos seus dados para ninguém.</li>
                <li>
                  Você pode ver, corrigir, baixar ou excluir seus dados quando quiser, no seu
                  perfil.
                </li>
              </ul>
              <Link href="/privacidade" className={inlineLink}>
                Ler a Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
        <SignupForm next={next} authApple={authApple} className="md:flex-[1_1_480px]" />
      </div>
    </div>
  );
}
