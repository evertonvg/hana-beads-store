import type { AddressLookupPort } from "@/lib/data/ports";
import { formatCep } from "@/lib/format";

type ViaCepBody = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

/** ViaCEP lookup. Any failure (bad CEP, unknown CEP, status, timeout, network) is "not found". */
export function createViaCepLookup(
  deps: { fetch?: typeof fetch; timeoutMs?: number } = {},
): AddressLookupPort {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 3000;
  return {
    async byCep(cep) {
      const digits = cep.replace(/\D/g, "");
      if (!/^\d{8}$/.test(digits)) return null;
      try {
        const res = await doFetch(`https://viacep.com.br/ws/${digits}/json/`, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status !== 200) return null;
        const body = (await res.json()) as ViaCepBody;
        if (body.erro) return null;
        return {
          cep: formatCep(digits),
          street: body.logradouro ?? "",
          district: body.bairro ?? "",
          city: body.localidade ?? "",
          state: body.uf ?? "",
        };
      } catch {
        return null;
      }
    },
  };
}
