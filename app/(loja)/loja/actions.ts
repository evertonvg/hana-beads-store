"use server";

import { getData } from "@/lib/data";
import { allowAttempt, RATE_LIMITED } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";
import { stockAlertSchema } from "@/lib/validation/stock-alert";

export type FavoriteResult =
  | { status: "ok"; favorite: boolean }
  | { status: "auth_required" }
  | { status: "error"; message: string };

/** Text value of a form field ("" for missing or file values). */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Favorites need an account: without a session the client is sent to /entrar. */
export async function toggleFavoriteAction(productId: string): Promise<FavoriteResult> {
  const session = await getSession();
  if (!session) return { status: "auth_required" };
  try {
    const [product] = await getData().catalog.byIds([String(productId)]);
    if (!product) return { status: "error", message: "Item não encontrado." };
    const favorite = await getData().engagement.toggleFavorite(session.id, product.id);
    return { status: "ok", favorite };
  } catch (error) {
    console.error("toggleFavoriteAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/**
 * "AVISE-ME" for a sold-out item. Signed in: the click is the confirmation and the session
 * e-mail is used. Signed out: e-mail + consent are revalidated here with the same schema.
 */
export async function stockAlertAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = field(formData, "productId");
  const session = await getSession();

  let email: string;
  if (session) {
    email = session.email;
  } else {
    const parsed = stockAlertSchema.safeParse({
      email: field(formData, "email"),
      consent: formData.get("consent") === "true",
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Confira os campos.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    email = parsed.data.email;
  }

  try {
    if (!(await allowAttempt("aviso_estoque", email))) {
      return { status: "error", message: RATE_LIMITED };
    }
    const [product] = await getData().catalog.byIds([productId]);
    if (!product) return { status: "error", message: "Item não encontrado." };
    if (product.stock > 0) return { status: "error", message: "Este item já está disponível." };
    await getData().engagement.requestStockAlert({
      userId: session?.id ?? null,
      email,
      productId: product.id,
      consentedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("stockAlertAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  return {
    status: "ok",
    message: session
      ? "Vamos te avisar por e-mail quando voltar. Dá para cancelar no seu perfil."
      : "Vamos te avisar por e-mail quando voltar.",
  };
}
