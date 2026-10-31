import { z } from "zod";
import { emailField } from "./auth";

/** Version of the consent text shown next to the newsletter checkbox; bump when the text changes. */
export const NEWSLETTER_CONSENT_VERSION = "2026-10-28";

export const newsletterSchema = z.object({
  email: emailField,
  consent: z
    .boolean({ error: "Marque a caixa para continuar." })
    .refine((v): v is true => v, { error: "Marque a caixa para continuar." }),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
