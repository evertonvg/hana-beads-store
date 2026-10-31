"use server";

import { revalidatePath } from "next/cache";
import { getData } from "@/lib/data";
import { parseProvider } from "@/lib/auth/providers";
import { publicEnv } from "@/lib/env";
import { getSession } from "@/lib/session";
import { addressSchema } from "@/lib/validation/address";
import {
  changePasswordSchema,
  deleteAccountSchema,
  MARKETING_CONSENT_VERSION,
  profileSchema,
} from "@/lib/validation/account";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";

const SESSION_ERROR = "Sua sessão expirou. Entre de novo.";

const failed = (message = GENERIC_ERROR): FormState => ({ status: "error", message });
const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): FormState => ({
  status: "error",
  message: "Confira os campos.",
  fieldErrors: fieldErrorsFrom(error),
});

/**
 * Runs `work` for the signed-in user. The user comes only from the session, never from the client,
 * so one user can never reach another one's data. An unknown or deleted user counts as signed out.
 */
async function asUser(work: (userId: string) => Promise<FormState>): Promise<FormState> {
  const user = await getSession().catch(() => null);
  if (!user) return failed(SESSION_ERROR);
  try {
    const result = await work(user.id);
    if (result.status === "ok") revalidatePath("/conta");
    return result;
  } catch (error) {
    console.error("account action failed", error);
    return failed();
  }
}

/** "Meus dados": name, phone and the optional CPF (the e-mail does not change here). */
export async function updateProfileAction(input: unknown): Promise<FormState> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, phone, cpf } = parsed.data;
  return asUser(async (userId) => {
    await getData().account.updateProfile(userId, { name, phone, cpf: cpf === "" ? null : cpf });
    return { status: "ok", message: "Dados salvos." };
  });
}

export async function changePasswordAction(input: unknown): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { current, next } = parsed.data;
  return asUser(async (userId) => {
    const { ok } = await getData().account.changePassword(userId, current, next);
    return ok
      ? { status: "ok", message: "Senha alterada." }
      : {
          status: "error",
          message: "Confira os campos.",
          fieldErrors: { current: "Senha atual incorreta." },
        };
  });
}

/** Adds or edits an address of the signed-in user. */
export async function saveAddressAction(input: unknown): Promise<FormState> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, label, complement, isDefault, ...street } = parsed.data;
  return asUser(async (userId) => {
    await getData().account.upsertAddress(userId, {
      ...(id ? { id } : {}),
      ...(label ? { label } : {}),
      ...street,
      ...(complement ? { complement } : {}),
      isDefault,
    });
    return { status: "ok", message: "Endereço salvo." };
  });
}

const idOf = (id: unknown) => (typeof id === "string" && id.length <= 80 ? id : null);

export async function deleteAddressAction(id: unknown): Promise<FormState> {
  const addressId = idOf(id);
  if (!addressId) return failed();
  return asUser(async (userId) => {
    await getData().account.deleteAddress(userId, addressId);
    return { status: "ok", message: "Endereço removido." };
  });
}

export async function setDefaultAddressAction(id: unknown): Promise<FormState> {
  const addressId = idOf(id);
  if (!addressId) return failed();
  return asUser(async (userId) => {
    await getData().account.setDefaultAddress(userId, addressId);
    return { status: "ok", message: "Endereço principal atualizado." };
  });
}

/** The newsletter switch. Each change appends a record to the consent history. */
export async function setMarketingConsentAction(granted: unknown): Promise<FormState> {
  if (typeof granted !== "boolean") return failed();
  return asUser(async (userId) => {
    await getData().account.setConsent(
      userId,
      "email_marketing",
      granted,
      MARKETING_CONSENT_VERSION,
    );
    return {
      status: "ok",
      message: granted ? "Você vai receber novidades." : "Novidades desligadas.",
    };
  });
}

/** The mock links every provider to the account e-mail; a real OAuth round trip replaces this. */
export async function connectProviderAction(provider: unknown): Promise<FormState> {
  const p = parseProvider(provider, publicEnv.authApple);
  if (!p) return failed();
  return asUser(async (userId) => {
    await getData().account.connect(userId, p);
    return { status: "ok", message: "Conta conectada." };
  });
}

export async function disconnectProviderAction(provider: unknown): Promise<FormState> {
  const p = parseProvider(provider, publicEnv.authApple);
  if (!p) return failed();
  return asUser(async (userId) => {
    const { ok } = await getData().account.disconnect(userId, p);
    return ok
      ? { status: "ok", message: "Conta desconectada." }
      : {
          status: "error",
          message: "Essa é sua única forma de entrar. Crie uma senha antes de desconectar.",
        };
  });
}

/**
 * Deletes the account after the password is confirmed. The client then signs out and empties its
 * cart WITHOUT saving it (the account no longer exists).
 */
export async function deleteAccountAction(input: unknown): Promise<FormState> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { password } = parsed.data;
  return asUser(async (userId) => {
    const { ok } = await getData().account.deleteAccount(userId, password);
    return ok
      ? { status: "ok" }
      : {
          status: "error",
          message: "Confira os campos.",
          fieldErrors: { password: "Senha incorreta." },
        };
  });
}
