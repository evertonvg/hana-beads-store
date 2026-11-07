import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFallback, first, type SearchParams } from "@/components/conta/AuthPage";
import { ConfirmEmailNotice } from "@/components/conta/ConfirmEmailNotice";
import { safeNext } from "@/lib/auth/redirect";
import { maskEmail } from "@/lib/format";
import { emailField } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Confira seu e-mail | Pixel Perfect Artesanato",
  robots: { index: false },
};

async function Notice({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = emailField.safeParse(first(params.email) ?? "");
  // Nothing to show or resend without a well-formed e-mail: back to the sign-up form.
  if (!email.success) redirect("/cadastro");
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-10 md:px-6 md:pt-[72px] md:pb-24">
      <ConfirmEmailNotice
        email={email.data}
        masked={maskEmail(email.data)}
        next={safeNext(first(params.next))}
      />
    </div>
  );
}

/** Where sign-up lands: no session until the link in the e-mail is opened. */
export default function ConfirmeSeuEmailPage(props: PageProps<"/cadastro/confirme-seu-email">) {
  return (
    <Suspense fallback={<AuthFallback />}>
      <Notice searchParams={props.searchParams} />
    </Suspense>
  );
}
