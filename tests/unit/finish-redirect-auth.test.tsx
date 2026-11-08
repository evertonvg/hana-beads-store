import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { syncCartAction } = vi.hoisted(() => ({ syncCartAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(conta)/actions", () => ({ syncCartAction }));

import { FinishRedirectAuth } from "@/components/conta/FinishRedirectAuth";
import { FINISH_AUTH_COOKIE } from "@/lib/auth/finish-auth-marker";
import { useCartStore } from "@/lib/cart/store";

const guestLine = { productId: "garota", ring: "mosquetao" as const, qty: 1 };
const savedLine = { productId: "e13", ring: "mosquetao" as const, qty: 1 };

const setMarker = () => (document.cookie = `${FINISH_AUTH_COOKIE}=1; path=/`);
const hasMarker = () => document.cookie.includes(`${FINISH_AUTH_COOKIE}=1`);

beforeEach(async () => {
  document.cookie = `${FINISH_AUTH_COOKIE}=; Max-Age=0; path=/`;
  localStorage.clear();
  syncCartAction.mockReset();
  syncCartAction.mockResolvedValue({ lines: [guestLine, savedLine], owner: "ana" });
  await useCartStore.persist.rehydrate();
  useCartStore.setState({ lines: [guestLine], owner: null });
});

describe("FinishRedirectAuth", () => {
  it("with the marker: syncs the cart once, takes the server's result and drops the marker", async () => {
    setMarker();
    render(<FinishRedirectAuth />);
    await waitFor(() => expect(useCartStore.getState().owner).toBe("ana"));
    expect(syncCartAction).toHaveBeenCalledExactlyOnceWith([guestLine], null);
    expect(useCartStore.getState().lines).toEqual([guestLine, savedLine]);
    expect(hasMarker()).toBe(false);
  });

  it("without the marker does nothing", async () => {
    render(<FinishRedirectAuth />);
    await new Promise((r) => setTimeout(r, 20));
    expect(syncCartAction).not.toHaveBeenCalled();
    expect(useCartStore.getState().owner).toBeNull();
  });

  it("a second mount after the sync does not sync again", async () => {
    setMarker();
    const first = render(<FinishRedirectAuth />);
    await waitFor(() => expect(syncCartAction).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<FinishRedirectAuth />);
    await new Promise((r) => setTimeout(r, 20));
    expect(syncCartAction).toHaveBeenCalledTimes(1);
  });

  it("a failed sync keeps the local cart", async () => {
    setMarker();
    syncCartAction.mockRejectedValueOnce(new Error("offline"));
    render(<FinishRedirectAuth />);
    await waitFor(() => expect(syncCartAction).toHaveBeenCalledTimes(1));
    expect(useCartStore.getState().lines).toEqual([guestLine]);
    expect(hasMarker()).toBe(false);
  });
});
