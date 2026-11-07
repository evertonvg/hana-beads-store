import { beforeEach, describe, expect, it, vi } from "vitest";

const { toggleFavorite, requestStockAlert, byIds, getSession, allowAttempt } = vi.hoisted(() => ({
  toggleFavorite: vi.fn(),
  requestStockAlert: vi.fn(),
  byIds: vi.fn(),
  getSession: vi.fn(),
  allowAttempt: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getData: () => ({
    catalog: { byIds },
    engagement: { toggleFavorite, requestStockAlert },
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/rate-limit", () => ({
  allowAttempt,
  RATE_LIMITED: "Muitas tentativas. Tente de novo em alguns minutos.",
}));

import { stockAlertAction, toggleFavoriteAction } from "@/app/(loja)/loja/actions";

const user = { id: "u1", name: "Ana", email: "ana@teste.dev" };
const soldOut = { id: "planeta", stock: 0 };
const idle = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of [toggleFavorite, requestStockAlert, byIds, getSession, allowAttempt]) {
    fn.mockReset();
  }
  allowAttempt.mockResolvedValue(true);
  getSession.mockResolvedValue(null);
  byIds.mockResolvedValue([soldOut]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("toggleFavoriteAction", () => {
  it("asks for sign-in without a session and does not touch the port", async () => {
    expect(await toggleFavoriteAction("garota")).toEqual({ status: "auth_required" });
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it("toggles for the signed-in user", async () => {
    getSession.mockResolvedValue(user);
    toggleFavorite.mockResolvedValue(true);
    expect(await toggleFavoriteAction("planeta")).toEqual({ status: "ok", favorite: true });
    expect(toggleFavorite).toHaveBeenCalledWith("u1", "planeta");
  });

  it("rejects an unknown product", async () => {
    getSession.mockResolvedValue(user);
    byIds.mockResolvedValue([]);
    expect((await toggleFavoriteAction("nada")).status).toBe("error");
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it("returns an error when the port throws", async () => {
    getSession.mockResolvedValue(user);
    toggleFavorite.mockRejectedValue(new Error("boom"));
    expect((await toggleFavoriteAction("planeta")).status).toBe("error");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("stockAlertAction", () => {
  it("requires a valid e-mail and the consent when signed out", async () => {
    const state = await stockAlertAction(
      idle,
      form({ productId: "planeta", email: "x", consent: "false" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(state.fieldErrors).toHaveProperty("consent");
    expect(requestStockAlert).not.toHaveBeenCalled();
  });

  it("refuses over the limit without calling the port", async () => {
    allowAttempt.mockResolvedValueOnce(false);
    const state = await stockAlertAction(
      idle,
      form({ productId: "planeta", email: "ana@teste.dev", consent: "true" }),
    );
    expect(state).toEqual({
      status: "error",
      message: "Muitas tentativas. Tente de novo em alguns minutos.",
    });
    expect(allowAttempt).toHaveBeenCalledWith("aviso_estoque", "ana@teste.dev");
    expect(requestStockAlert).not.toHaveBeenCalled();
  });

  it("records the alert with the consent time when signed out", async () => {
    const state = await stockAlertAction(
      idle,
      form({ productId: "planeta", email: "ana@teste.dev", consent: "true" }),
    );
    expect(state.status).toBe("ok");
    expect(requestStockAlert).toHaveBeenCalledWith({
      userId: null,
      email: "ana@teste.dev",
      productId: "planeta",
      consentedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
    });
  });

  it("confirms directly for a signed-in user, using the session e-mail", async () => {
    getSession.mockResolvedValue(user);
    const state = await stockAlertAction(
      idle,
      form({ productId: "planeta", email: "outro@teste.dev" }),
    );
    expect(state.status).toBe("ok");
    expect(requestStockAlert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", email: "ana@teste.dev", productId: "planeta" }),
    );
  });

  it("rejects an unknown product and one that is still in stock", async () => {
    const input = { email: "ana@teste.dev", consent: "true" };
    byIds.mockResolvedValueOnce([]);
    expect((await stockAlertAction(idle, form({ ...input, productId: "nada" }))).status).toBe(
      "error",
    );
    byIds.mockResolvedValueOnce([{ id: "garota", stock: 5 }]);
    expect((await stockAlertAction(idle, form({ ...input, productId: "garota" }))).status).toBe(
      "error",
    );
    expect(requestStockAlert).not.toHaveBeenCalled();
  });

  it("returns an error state when the port throws", async () => {
    requestStockAlert.mockRejectedValue(new Error("boom"));
    const state = await stockAlertAction(
      idle,
      form({ productId: "planeta", email: "ana@teste.dev", consent: "true" }),
    );
    expect(state).toEqual({ status: "error", message: "Não foi possível agora. Tente de novo." });
    expect(console.error).toHaveBeenCalled();
  });
});
