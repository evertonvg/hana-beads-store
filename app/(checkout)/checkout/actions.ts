"use server";

import {
  priceCartAction,
  quoteShippingAction,
  validateCouponAction,
} from "@/app/(loja)/carrinho/actions";
import { hasTooManyLines, sanitizeCart } from "@/lib/cart/merge";
import { computeTotals } from "@/lib/cart/totals";
import { getData } from "@/lib/data";
import type { Address } from "@/lib/data/types";
import { isValidCep } from "@/lib/format";
import { rememberGuestToken } from "@/lib/guest-orders";
import { allowAttempt, RATE_LIMITED } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { CHECKOUT_CONSENT_VERSION, checkoutSchema } from "@/lib/validation/checkout";
import { fieldErrorsFrom, type FormState, GENERIC_ERROR } from "@/lib/validation/form-state";

/**
 * `redirectTo` is where the client goes next. `accountPending` = "save my data" was asked: an
 * account waits for e-mail confirmation (the same answer when the e-mail already had one).
 */
export type PlaceOrderResult = FormState & {
  redirectTo?: string;
  accountPending?: boolean;
  /** Owner of the order when signed in: the client syncs its cart owner when it differs. */
  userId?: string;
};

const fail = (message: string, fieldErrors?: Record<string, string>): PlaceOrderResult => ({
  status: "error",
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

/** `lines` travels next to the form values but is not part of the validated schema. */
function linesOf(input: unknown): unknown {
  return typeof input === "object" && input !== null ? (input as { lines?: unknown }).lines : null;
}

/** Street data for a CEP (null = unknown CEP: the user types it). */
export async function lookupCepAction(
  cep: string,
): Promise<Omit<Address, "number" | "complement"> | null> {
  if (typeof cep !== "string" || !isValidCep(cep)) return null;
  return getData().addressLookup.byCep(cep);
}

/**
 * Creates the order. Everything that costs money is recomputed here from product ids and
 * quantities: prices, the shipping option for the CEP and the coupon. The same checkout token
 * always gives back the same order (double click, retry). The cart is NOT cleared: that happens
 * when the payment is confirmed.
 */
export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Confira os campos.", fieldErrorsFrom(parsed.error));
  }
  const v = parsed.data;
  try {
    const raw = linesOf(input);
    if (hasTooManyLines(raw)) return fail("Revise o carrinho.");
    const lines = sanitizeCart({ lines: raw }).lines;
    if (lines.length === 0) return fail("Seu carrinho está vazio.");
    const { lines: priced, unknownIds } = await priceCartAction(lines);
    if (unknownIds.length > 0 || priced.length === 0) {
      return fail("Algum item do carrinho não está mais disponível. Revise o carrinho.");
    }

    const quotes = await quoteShippingAction({
      cep: v.cep,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    });
    if (!Array.isArray(quotes)) {
      return fail("Confira os campos.", {
        cep:
          quotes.error === "cep_invalido"
            ? "Informe um CEP válido (8 números)."
            : "CEP não atendido.",
      });
    }
    const shipping = quotes.find((q) => q.id === v.shippingId);
    if (!shipping) return fail("Confira os campos.", { shippingId: "Escolha uma opção de frete." });

    let discountCents = 0;
    if (v.couponCode) {
      const coupon = await validateCouponAction({ code: v.couponCode, lines });
      if (!coupon.ok) return fail("O cupom não vale mais. Volte ao carrinho para revisar.");
      discountCents = coupon.discountCents ?? 0;
    }
    const totals = computeTotals(priced, shipping.priceCents, discountCents);

    const address: Address = {
      cep: v.cep,
      street: v.street,
      number: v.number,
      ...(v.complement ? { complement: v.complement } : {}),
      district: v.district,
      city: v.city,
      state: v.state,
    };

    const { auth, orders, payments } = getData();
    const session = await getSession();
    const userId = session?.id ?? null;
    const accountPending = !userId && v.saveAccount;
    // Owner recorded on a guest order: the account created just now (null if the e-mail had one).
    let pendingUserId: string | null = null;
    if (accountPending) {
      // Each one may (re)send a confirmation e-mail: counted like the sign-up form, before
      // anything is created, with the same answer whether or not the e-mail has an account.
      if (!(await allowAttempt("cadastro", v.email))) return fail(RATE_LIMITED);
      // Optional "save my data" path. Terms are accepted by the notice next to the button, not
      // by a checkbox (flagged for legal review); marketing e-mail is never opted in here.
      // The account stays pending e-mail confirmation, so the order goes on as a guest order,
      // already tied to the new account. The order id is unknown here: the link opens the list.
      const created = await auth.signUp(
        {
          name: v.name,
          email: v.email,
          phone: v.phone,
          password: v.password ?? "",
          acceptTerms: true,
          marketingEmail: false,
          termsVersion: CHECKOUT_CONSENT_VERSION,
          cpf: v.cpf,
          address,
        },
        "/conta/pedidos",
      );
      pendingUserId = created.userId;
    }

    const order = await orders.create(
      {
        userId: userId ?? pendingUserId,
        guestToken: userId ? null : crypto.randomUUID(),
        paymentMethod: v.payment,
        items: priced.map((l) => ({
          productId: l.productId,
          name: l.product.name,
          ring: l.ring,
          unitPriceCents: l.unitCents,
          qty: l.qty,
          image: l.product.images[0] ?? null,
        })),
        subtotalCents: totals.subtotalCents,
        shippingCents: shipping.priceCents,
        discountCents,
        totalCents: totals.totalCents,
        shippingAddress: address,
        customer: { name: v.name, email: v.email, phone: v.phone, cpf: v.cpf },
        shippingService: shipping.service,
      },
      v.checkoutToken,
    );
    // A retried token gets back the first order, with the guest token it was created with.
    if (order.guestToken) await rememberGuestToken(order.guestToken);

    // The payment starts here, where the card token is at hand. A retried token gets back the
    // order with its payment already started (possibly switched to Pix): do not start it again.
    const payment =
      order.payment ??
      (await payments.start(
        order.id,
        v.payment,
        v.payment === "cartao" ? { token: v.cardToken ?? "", last4: v.cardLast4 ?? "" } : undefined,
      ));
    const approved = payment.kind === "cartao" && payment.result === "aprovado";
    const screen = `/pedido/${order.id}/${approved ? "confirmado" : "pagamento"}`;
    return {
      status: "ok",
      redirectTo: accountPending ? `${screen}?conta=pendente` : screen,
      // No session until the e-mail is confirmed: the client keeps its guest cart.
      accountPending,
      // Only the signed-in owner: never tells whether a pending account was created.
      ...(userId ? { userId } : {}),
    };
  } catch (error) {
    console.error("placeOrderAction failed", error);
    return fail(GENERIC_ERROR);
  }
}
