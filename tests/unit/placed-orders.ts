import { orderFixtures } from "@/lib/data/mock/fixtures";
import { getMockStore } from "@/lib/data/mock/store";

/** Orders created while a test ran: the mock store also holds ana's fixture history. */
export const placedOrders = () =>
  getMockStore().orders.filter((o) => !orderFixtures.some((f) => f.id === o.id));
