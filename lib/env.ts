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
 */
export const serverEnvSchema = z.object({
  DATA_SOURCE: z.enum(["mock"]),
  // iron-session requires a secret of 32+ characters
  SESSION_SECRET: z.string().min(32),
});

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
  server: serverEnvSchema.shape,
  client: publicEnvSchema.shape,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CONTACT_CHANNEL: process.env.NEXT_PUBLIC_CONTACT_CHANNEL,
    NEXT_PUBLIC_INSTAGRAM_USER: process.env.NEXT_PUBLIC_INSTAGRAM_USER,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_FREE_SHIPPING_CENTS: process.env.NEXT_PUBLIC_FREE_SHIPPING_CENTS,
    NEXT_PUBLIC_PARALLAX_INTENSITY: process.env.NEXT_PUBLIC_PARALLAX_INTENSITY,
    NEXT_PUBLIC_AUTH_APPLE: process.env.NEXT_PUBLIC_AUTH_APPLE,
    NEXT_PUBLIC_ANALYTICS_SRC: process.env.NEXT_PUBLIC_ANALYTICS_SRC,
  },
  emptyStringAsUndefined: true,
});

export const publicEnv: PublicEnv = toPublicEnv(env);
