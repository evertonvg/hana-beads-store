import { z } from "zod";

import { passwordField } from "./auth";

/** New password (same rules as sign-up) and its confirmation. */
export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().max(200),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    error: "As senhas não conferem.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
