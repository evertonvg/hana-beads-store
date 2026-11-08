"use server";

import { getData } from "@/lib/data";
import { getSession } from "@/lib/session";
import { resetPasswordSchema } from "@/lib/validation/reset-password";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";

export type ResetPasswordResult = FormState & { redirectTo?: string };

const NO_SESSION = "Sua sessão expirou. Peça um novo link.";
const REFUSED = "Não foi possível alterar a senha. Tente outra senha ou peça um novo link.";

/**
 * "/redefinir-senha": sets the new password of the session the e-mail link opened (recovery, or
 * a re-signed-up account) and ends every other session. Never logs the password.
 */
export async function resetPasswordAction(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    if (!(await getSession())) return { status: "error", message: NO_SESSION };
    const { ok } = await getData().auth.updatePassword(parsed.data.password);
    if (!ok) return { status: "error", message: REFUSED };
    return { status: "ok", message: "Senha alterada.", redirectTo: "/conta" };
  } catch (error) {
    console.error("resetPasswordAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
