import type { ZodError } from "zod";

/** Shown when a server action throws or a request fails; one wording for every form. */
export const GENERIC_ERROR = "Não foi possível agora. Tente de novo.";

/** Result shape shared by every server action that backs a form. */
export type FormState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/** First message per field, keyed by the dotted path of the issue. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}
