import { describe, expect, it, vi } from "vitest";

import { createViaCepLookup } from "@/lib/data/viacep";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const asFetch = (fn: unknown) => fn as typeof fetch;

describe("viacep lookup", () => {
  it("maps a found CEP and calls the digits-only URL", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
      json({
        cep: "01001-000",
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      }),
    );
    const lookup = createViaCepLookup({ fetch: asFetch(fetchMock) });
    expect(await lookup.byCep("01001-000")).toEqual({
      cep: "01001-000",
      street: "Praça da Sé",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://viacep.com.br/ws/01001000/json/");
  });

  it("returns null for { erro: true } and for a non-200 status", async () => {
    const erro = createViaCepLookup({ fetch: asFetch(() => json({ erro: true })) });
    expect(await erro.byCep("99999999")).toBeNull();
    const down = createViaCepLookup({ fetch: asFetch(() => json({}, 500)) });
    expect(await down.byCep("01001000")).toBeNull();
  });

  it("returns null when fetch throws or never answers (timeout)", async () => {
    const boom = createViaCepLookup({
      fetch: asFetch(() => Promise.reject(new Error("offline"))),
    });
    expect(await boom.byCep("01001000")).toBeNull();

    const hang = (_url: string, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const slow = createViaCepLookup({ fetch: asFetch(hang), timeoutMs: 50 });
    expect(await slow.byCep("01001000")).toBeNull();
  });

  it("does not call fetch for a malformed CEP", async () => {
    const fetchMock = vi.fn();
    const lookup = createViaCepLookup({ fetch: asFetch(fetchMock) });
    expect(await lookup.byCep("123")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
