import { formatPhone as formatBrPhone } from "@brazilian-utils/brazilian-utils";
import { tz } from "@date-fns/tz";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

export {
  formatCep,
  formatCpf,
  isValidCep,
  isValidCpf,
  isValidPhone,
} from "@brazilian-utils/brazilian-utils";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Formats a Brazilian phone with DDD. The library's default mask ("sn") drops the last digit
 * of DDD-prefixed numbers, so `"auto"` is required.
 */
export function formatPhone(value: string): string {
  return formatBrPhone(value, { mask: "auto" });
}

/** Keeps only the digits of a string (strips masks such as CPF, CEP or phone punctuation). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats cents as BRL (`R$ 12,00`). Screens use `priceLabel`/`totalLabel`, which handle null. */
export function formatPrice(cents: number): string {
  return brl.format(cents / 100).replaceAll(/[  ]/g, " ");
}

/** Price of an item (card, line): `R$ 12,00`, or the design's `R$ [PREÇO]` placeholder. */
export function priceLabel(cents: number | null): string {
  return cents === null ? "R$ [PREÇO]" : formatPrice(cents);
}

/** Amount of a sum (subtotal, shipping, total): `R$ 12,00`, or the design's `R$ [VALOR]`. */
export function totalLabel(cents: number | null): string {
  return cents === null ? "R$ [VALOR]" : formatPrice(cents);
}

/** Store timezone. Dates are always shown in Brazil, never in the machine or browser timezone. */
const SAO_PAULO = "America/Sao_Paulo";

/** Formats an ISO date in pt-BR, or the `[00/00/0000]` placeholder when there is no date. */
export function formatDate(iso: string | null, pattern = "dd/MM/yyyy"): string {
  if (iso === null) return "[00/00/0000]";
  return format(parseISO(iso), pattern, { in: tz(SAO_PAULO), locale: ptBR });
}

/** Formats an order number for display, e.g. `"0005"` becomes `"#0005"`. */
export function formatOrderNumber(n: string): string {
  return `#${n}`;
}
