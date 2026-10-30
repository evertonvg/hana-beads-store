import type { ReturnsPort } from "@/lib/data/ports";
import { REGRET_DAYS } from "@/lib/validation/return";

import { getMockStore } from "./store";

const DAY_MS = 86_400_000;

export function createMockReturns(): ReturnsPort {
  return {
    create(userId, input) {
      const store = getMockStore();
      // Ownership rule (simulates RLS): another user's order looks like it does not exist.
      const order = store.orders.find((o) => o.id === input.orderId && o.userId === userId);
      if (!order) return Promise.resolve({ error: "pedido_nao_encontrado" });
      if (order.status !== "enviado" && order.status !== "entregue") {
        return Promise.resolve({ error: "pedido_indisponivel" });
      }
      if (input.reason === "arrependimento") {
        const deliveredAt = order.events.findLast((e) => e.status === "entregue")?.at;
        const inTime =
          deliveredAt !== undefined &&
          Date.now() - new Date(deliveredAt).getTime() <= REGRET_DAYS * DAY_MS;
        if (!inTime) return Promise.resolve({ error: "fora_do_prazo" });
      }
      const protocol = `T-${String(store.returns.length + 1).padStart(4, "0")}`;
      store.returns.push({
        protocol,
        userId,
        orderId: order.id,
        reason: input.reason,
        description: input.description,
        preference: input.preference,
        // Metadata only: the mock never keeps the file bytes.
        photos: input.photos.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      });
      return Promise.resolve({ protocol });
    },
  };
}
