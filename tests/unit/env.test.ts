import { describe, expect, it } from "vitest";
import { publicEnvSchema, serverEnvSchema, toPublicEnv } from "@/lib/env";

const parse = (raw: Record<string, string | undefined>) => toPublicEnv(publicEnvSchema.parse(raw));

describe("publicEnv", () => {
  it("applies defaults when nothing is set", () => {
    const env = parse({});
    expect(env.contactChannel).toBe("instagram");
    expect(env.parallaxIntensity).toBe(1);
    expect(env.freeShippingCents).toBeNull();
    expect(env.authApple).toBe(false);
    expect(env.instagramUser).toBeNull();
    expect(env.whatsappNumber).toBeNull();
    expect(env.analyticsSrc).toBeNull();
  });

  it("clamps parallax intensity to 0-2", () => {
    expect(parse({ NEXT_PUBLIC_PARALLAX_INTENSITY: "9" }).parallaxIntensity).toBe(2);
    expect(parse({ NEXT_PUBLIC_PARALLAX_INTENSITY: "-3" }).parallaxIntensity).toBe(0);
  });

  it("falls back to instagram on an unknown contact channel", () => {
    expect(parse({ NEXT_PUBLIC_CONTACT_CHANNEL: "telegram" }).contactChannel).toBe("instagram");
  });

  it("reads optional values", () => {
    const env = parse({
      NEXT_PUBLIC_CONTACT_CHANNEL: "whatsapp",
      NEXT_PUBLIC_FREE_SHIPPING_CENTS: "20000",
      NEXT_PUBLIC_AUTH_APPLE: "true",
    });
    expect(env.contactChannel).toBe("whatsapp");
    expect(env.freeShippingCents).toBe(20000);
    expect(env.authApple).toBe(true);
  });
});

describe("serverEnv", () => {
  const secret = "x".repeat(32);

  it("requires DATA_SOURCE: the mock test routes must never open by omission", () => {
    expect(serverEnvSchema.safeParse({ SESSION_SECRET: secret }).success).toBe(false);
    expect(serverEnvSchema.safeParse({ DATA_SOURCE: "mock", SESSION_SECRET: secret }).success).toBe(
      true,
    );
  });

  it("rejects an unknown DATA_SOURCE and a short secret", () => {
    expect(serverEnvSchema.safeParse({ DATA_SOURCE: "pg", SESSION_SECRET: secret }).success).toBe(
      false,
    );
    expect(
      serverEnvSchema.safeParse({ DATA_SOURCE: "mock", SESSION_SECRET: "curto" }).success,
    ).toBe(false);
  });

  const supabase = {
    DATA_SOURCE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    SUPABASE_SECRET_KEY: "sb_secret_x",
    REVALIDATE_SECRET: "r".repeat(32),
  };

  it("accepts supabase with its variables", () => {
    expect(serverEnvSchema.safeParse(supabase).success).toBe(true);
  });

  it("rejects supabase without SUPABASE_SECRET_KEY", () => {
    const rest: Record<string, string> = { ...supabase };
    delete rest.SUPABASE_SECRET_KEY;
    expect(serverEnvSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects supabase with a short REVALIDATE_SECRET", () => {
    expect(serverEnvSchema.safeParse({ ...supabase, REVALIDATE_SECRET: "curto" }).success).toBe(
      false,
    );
  });

  it("rejects mock without SESSION_SECRET", () => {
    expect(serverEnvSchema.safeParse({ DATA_SOURCE: "mock" }).success).toBe(false);
  });

  it("defaults CLIENT_IP_HEADER to x-forwarded-for", () => {
    const parsed = serverEnvSchema.parse({ DATA_SOURCE: "mock", SESSION_SECRET: secret });
    expect(parsed.CLIENT_IP_HEADER).toBe("x-forwarded-for");
  });
});
