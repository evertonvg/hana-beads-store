import { describe, expect, it } from "vitest";
import { confirmedPath } from "@/lib/order-status";

describe("confirmedPath", () => {
  it("keeps ?conta=pendente only for a pending account", () => {
    expect(confirmedPath("p1")).toBe("/pedido/p1/confirmado");
    expect(confirmedPath("p1", true)).toBe("/pedido/p1/confirmado?conta=pendente");
  });
});
