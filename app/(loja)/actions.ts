"use server";

import { getData } from "@/lib/data";
import { allowAttempt, RATE_LIMITED } from "@/lib/rate-limit";
import { fieldErrorsFrom, type FormState } from "@/lib/validation/form-state";
import {
  NEWSLETTER_CONSENT_VERSION,
  newsletterSchema,
  type NewsletterInput,
} from "@/lib/validation/newsletter";

/** Newsletter signup. Revalidates with the same schema as the client: never trust the form. */
export async function subscribeNewsletter(input: NewsletterInput): Promise<FormState> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    if (!(await allowAttempt("newsletter", parsed.data.email))) {
      return { status: "error", message: RATE_LIMITED };
    }
    await getData().newsletter.subscribe({
      email: parsed.data.email,
      consent: true,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
    });
  } catch (error) {
    console.error("subscribeNewsletter failed", error);
    return { status: "error", message: "Não foi possível agora. Tente de novo." };
  }
  // One neutral message for new and already-subscribed e-mails: do not reveal membership.
  return {
    status: "ok",
    message: "YES! Confira sua caixa de entrada em breve: os novos personagens chegam por lá.",
  };
}
