import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Public (client-exposed) variables. Exported on its own so it can be unit tested. */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_CONTACT_CHANNEL: z.enum(["instagram", "whatsapp"]).catch("instagram"),
  NEXT_PUBLIC_INSTAGRAM_USER: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),
  NEXT_PUBLIC_FREE_SHIPPING_CENTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .catch(undefined),
  NEXT_PUBLIC_PARALLAX_INTENSITY: z.coerce
    .number()
    .catch(1)
    .transform((n) => Math.min(2, Math.max(0, n))),
  NEXT_PUBLIC_AUTH_APPLE: z
    .enum(["true", "false"])
    .catch("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_ANALYTICS_SRC: z.string().optional(),
});

/**
 * Server-only variables. `DATA_SOURCE` has no default on purpose: it gates the `/api/__mock__/*`
 * test routes, so a deploy that forgets it must fail to boot instead of exposing them.
 * Every mode-specific field is optional here; `refineServerEnv` requires the ones each mode needs.
 */
const supabasePublicShape = {
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
};

export const serverEnvShape = {
  DATA_SOURCE: z.enum(["mock", "supabase"]),
  // iron-session (mock adapter only) requires a secret of 32+ characters
  SESSION_SECRET: z.string().min(32).optional(),
  ...supabasePublicShape,
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  REVALIDATE_SECRET: z.string().min(32).optional(),
  CLIENT_IP_HEADER: z.string().min(1).default("x-forwarded-for"),
};

const supabaseRequired = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "REVALIDATE_SECRET",
] as const;

/** Cross-field rule: each data source requires its own variables. */
export function refineServerEnv(
  value: {
    DATA_SOURCE: "mock" | "supabase";
    SESSION_SECRET?: string | undefined;
  } & Partial<Record<(typeof supabaseRequired)[number], string | undefined>>,
  ctx: z.RefinementCtx,
) {
  const required = value.DATA_SOURCE === "mock" ? (["SESSION_SECRET"] as const) : supabaseRequired;
  for (const key of required) {
    if (!value[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required when DATA_SOURCE=${value.DATA_SOURCE}`,
      });
    }
  }
}

export const serverEnvSchema = z.object(serverEnvShape).superRefine(refineServerEnv);

type ParsedPublicEnv = z.output<typeof publicEnvSchema>;

export type PublicEnv = {
  siteUrl: string;
  contactChannel: "instagram" | "whatsapp";
  instagramUser: string | null;
  whatsappNumber: string | null;
  freeShippingCents: number | null;
  parallaxIntensity: number;
  authApple: boolean;
  analyticsSrc: string | null;
};

export function toPublicEnv(parsed: ParsedPublicEnv): PublicEnv {
  return {
    siteUrl: parsed.NEXT_PUBLIC_SITE_URL,
    contactChannel: parsed.NEXT_PUBLIC_CONTACT_CHANNEL,
    instagramUser: parsed.NEXT_PUBLIC_INSTAGRAM_USER ?? null,
    whatsappNumber: parsed.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null,
    freeShippingCents: parsed.NEXT_PUBLIC_FREE_SHIPPING_CENTS ?? null,
    parallaxIntensity: parsed.NEXT_PUBLIC_PARALLAX_INTENSITY,
    authApple: parsed.NEXT_PUBLIC_AUTH_APPLE,
    analyticsSrc: parsed.NEXT_PUBLIC_ANALYTICS_SRC ?? null,
  };
}

export const env = createEnv({
  // t3-env rejects NEXT_PUBLIC_ keys on the server side, so the two public Supabase keys live in `client`.
  server: {
    DATA_SOURCE: serverEnvShape.DATA_SOURCE,
    SESSION_SECRET: serverEnvShape.SESSION_SECRET,
    SUPABASE_SECRET_KEY: serverEnvShape.SUPABASE_SECRET_KEY,
    REVALIDATE_SECRET: serverEnvShape.REVALIDATE_SECRET,
    CLIENT_IP_HEADER: serverEnvShape.CLIENT_IP_HEADER,
  },
  client: { ...publicEnvSchema.shape, ...supabasePublicShape },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CONTACT_CHANNEL: process.env.NEXT_PUBLIC_CONTACT_CHANNEL,
    NEXT_PUBLIC_INSTAGRAM_USER: process.env.NEXT_PUBLIC_INSTAGRAM_USER,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_FREE_SHIPPING_CENTS: process.env.NEXT_PUBLIC_FREE_SHIPPING_CENTS,
    NEXT_PUBLIC_PARALLAX_INTENSITY: process.env.NEXT_PUBLIC_PARALLAX_INTENSITY,
    NEXT_PUBLIC_AUTH_APPLE: process.env.NEXT_PUBLIC_AUTH_APPLE,
    NEXT_PUBLIC_ANALYTICS_SRC: process.env.NEXT_PUBLIC_ANALYTICS_SRC,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  // The cross-field rule only applies where the server variables exist (the browser sees client keys only).
  createFinalSchema: (shape, isServer) =>
    isServer ? z.object(shape).superRefine(refineServerEnv) : z.object(shape),
  emptyStringAsUndefined: true,
});

export const publicEnv: PublicEnv = toPublicEnv(env);
