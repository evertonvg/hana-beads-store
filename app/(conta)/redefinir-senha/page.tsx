import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFallback } from "@/components/conta/AuthPage";
import { ResetPasswordForm } from "@/components/conta/ResetPasswordForm";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Nova senha | Pixel Perfect Artesanato",
  robots: { index: false },
};

/** Needs the session the e-mail link opened: without one, back to asking for a new link. */
async function Screen() {
  const user = await getSession().catch(() => null);
  if (!user) redirect("/recuperar-senha");
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-10 md:px-6 md:pt-[72px] md:pb-24">
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3 text-center">
          <p className="font-pixel text-[10px] text-yellow">NOVA SENHA</p>
          <h1 className="font-pixel text-[18px] leading-snug md:text-[22px]">CRIE SUA SENHA</h1>
          <p className="text-[15px] leading-relaxed text-text-muted">
            Escolha a senha que você vai usar para entrar na sua conta.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}

/** Where the recovery link (and the confirmation of a re-signed-up account) lands. */
export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Screen />
    </Suspense>
  );
}
