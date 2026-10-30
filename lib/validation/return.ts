import { z } from "zod";

/**
 * Largest accepted photo. A proposed limit that the owner still has to confirm: change it here
 * only (the Server Actions body limit in next.config.ts must stay above 4 photos of this size).
 */
export const MAX_RETURN_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_RETURN_PHOTOS = 4;
export const RETURN_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Days after delivery in which "arrependimento" is accepted (CDC art. 49). */
export const REGRET_DAYS = 7;

export const RETURN_REASONS = ["arrependimento", "defeito", "diferente", "outro"] as const;
export const RETURN_PREFERENCES = ["troca", "reembolso", "conserto"] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];
export type ReturnPreference = (typeof RETURN_PREFERENCES)[number];

const photoSchema = z
  .instanceof(File)
  .refine((f) => (RETURN_PHOTO_TYPES as readonly string[]).includes(f.type), {
    error: "Use fotos JPG, PNG ou WebP.",
  })
  .refine((f) => f.size > 0 && f.size <= MAX_RETURN_PHOTO_BYTES, {
    error: `Cada foto pode ter no máximo ${MAX_RETURN_PHOTO_BYTES / 1024 / 1024} MB.`,
  });

/** "Solicitar troca ou devolução". The server action revalidates with this same schema. */
export const returnSchema = z.object({
  orderId: z.string().min(1, { error: "Escolha o pedido." }).max(100),
  reason: z.enum(RETURN_REASONS, { error: "Escolha o motivo." }),
  description: z
    .string()
    .trim()
    .min(10, { error: "Conte um pouco mais (mínimo de 10 caracteres)." })
    .max(1000, { error: "Use no máximo 1000 caracteres." }),
  preference: z.enum(RETURN_PREFERENCES, { error: "Escolha o que você prefere." }),
  photos: z
    .array(photoSchema)
    .max(MAX_RETURN_PHOTOS, { error: `Envie no máximo ${MAX_RETURN_PHOTOS} fotos.` }),
});

export type ReturnInput = z.infer<typeof returnSchema>;
