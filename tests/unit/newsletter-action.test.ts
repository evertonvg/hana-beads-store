import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribe, allowAttempt } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  allowAttempt: vi.fn(),
}));
vi.mock("@/lib/data", () => ({ getData: () => ({ newsletter: { subscribe } }) }));
vi.mock("@/lib/rate-limit", () => ({
  allowAttempt,
  RATE_LIMITED: "Muitas tentativas. Tente de novo em alguns minutos.",
}));

import { subscribeNewsletter } from "@/app/(loja)/actions";

const valid = { email: "ana@teste.dev", consent: true } as const;

describe("subscribeNewsletter", () => {
  beforeEach(() => {
    subscribe.mockReset();
    allowAttempt.mockReset();
    allowAttempt.mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns field errors without calling the port for invalid input", async () => {
    const state = await subscribeNewsletter({ email: "x", consent: false } as never);
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(state.fieldErrors).toHaveProperty("consent");
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("returns the same message for new and already-subscribed e-mails", async () => {
    subscribe.mockResolvedValueOnce({ status: "ok" });
    const first = await subscribeNewsletter(valid);
    subscribe.mockResolvedValueOnce({ status: "already" });
    const second = await subscribeNewsletter(valid);
    expect(first.status).toBe("ok");
    expect(second).toEqual(first);
  });

  it("counts the attempt by e-mail and refuses over the limit without calling the port", async () => {
    allowAttempt.mockResolvedValueOnce(false);
    expect(await subscribeNewsletter(valid)).toEqual({
      status: "error",
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    });
    expect(allowAttempt).toHaveBeenCalledWith("newsletter", "ana@teste.dev");
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("returns an error state when the port throws", async () => {
    subscribe.mockRejectedValueOnce(new Error("boom"));
    const state = await subscribeNewsletter(valid);
    expect(state).toEqual({ status: "error", message: "Não foi possível agora. Tente de novo." });
    expect(console.error).toHaveBeenCalled();
  });
});
