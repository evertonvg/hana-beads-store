"use server";

import { revalidatePath } from "next/cache";
import { getData } from "@/lib/data";
import { getSession } from "@/lib/session";
import { fieldErrorsFrom } from "@/lib/validation/form-state";
import { returnSchema } from "@/lib/validation/return";

export type ReturnResult =
  | { status: "ok"; protocol: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Não foi possível agora. Tente de novo.";

const REJECTIONS = {
  pedido_nao_encontrado: { field: "orderId", text: "Pedido não encontrado." },
  pedido_indisponivel: {
    field: "orderId",
    text: "Esse pedido ainda não foi enviado. Escolha outro pedido.",
  },
  fora_do_prazo: {
    field: "reason",
    text: "Passou do prazo de 7 dias do direito de arrependimento (CDC art. 49). Escolha outro motivo.",
  },
} as const;

/**
 * "Solicitar troca ou devolução". Photos arrive as files in the FormData. The user comes only from
 * the session, and the data is checked again here with the same schema as the form.
 */
export async function createReturnAction(formData: FormData): Promise<ReturnResult> {
  const user = await getSession().catch(() => null);
  if (!user) return { status: "error", message: "Sua sessão expirou. Entre de novo." };

  const parsed = returnSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    description: formData.get("description"),
    preference: formData.get("preference"),
    photos: formData.getAll("photos").filter((v) => typeof v !== "string"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const result = await getData().returns.create(user.id, parsed.data);
    if ("error" in result) {
      const { field, text } = REJECTIONS[result.error];
      return { status: "error", message: text, fieldErrors: { [field]: text } };
    }
    revalidatePath("/conta/pedidos");
    return { status: "ok", protocol: result.protocol };
  } catch (error) {
    console.error("createReturnAction failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}
