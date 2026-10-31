"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
import { placeOrderAction, type PlaceOrderResult } from "@/app/(checkout)/checkout/actions";
import { AddressFields } from "@/components/address/AddressFields";
import { PasswordRules } from "@/components/conta/PasswordRules";
import { inlineLink } from "@/components/conta/styles";
import { useFinishAuth } from "@/components/conta/use-finish-auth";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PillRadioGroup } from "@/components/ui/PillRadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { readDraft } from "@/lib/cart/draft";
import { useCartStore } from "@/lib/cart/store";
import { computeTotals, type PricedLine } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";
import { cn } from "@/lib/cn";
import type { Address } from "@/lib/data/types";
import { isValidCep, onlyDigits, totalLabel } from "@/lib/format";
import { mockCardToken } from "@/lib/mock-card-token";
import {
  checkoutFormSchema,
  type CheckoutFormInput,
  type CheckoutFormOutput,
} from "@/lib/validation/checkout";
import { AccountBox } from "./AccountBox";
import { CheckoutBar } from "./CheckoutBar";
import { SummaryAside, SummaryDetails } from "./CheckoutSummary";
import { PaymentPicker } from "./PaymentPicker";
import { checkoutInput, legend, section } from "./styles";
import { useCheckoutQuotes } from "./use-checkout-lookups";
import { GENERIC_ERROR } from "@/lib/validation/form-state";

/** What the server knows about the signed-in user, used to pre-fill the form. */
export type CheckoutInitial = {
  user: { name: string; email: string } | null;
  phone: string;
  cpf: string;
  address: Address | null;
};

type Props = { initial: CheckoutInitial; lines: CartLine[]; priced: PricedLine[] };

/** Order in which the first invalid field gets the focus. */
const FOCUS_ORDER = [
  "name",
  "email",
  "phone",
  "cpf",
  "cep",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
  "shippingId",
  "payment",
  "card.number",
  "card.holder",
  "card.expiry",
  "card.cvv",
  "password",
] as const satisfies readonly FieldPath<CheckoutFormInput>[];

function hasError(errors: FieldErrors<CheckoutFormInput>, path: string): boolean {
  let node: unknown = errors;
  for (const key of path.split(".")) {
    node =
      typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : null;
  }
  return Boolean(node);
}

/** Focuses the control of a field: inputs by `name`, radio groups by their `data-field` wrapper. */
function focusField(path: string) {
  const el =
    document.querySelector<HTMLElement>(`[name="${path}"]`) ??
    document.querySelector<HTMLElement>(`[data-field="${path}"] [role="radio"]`) ??
    document.querySelector<HTMLElement>(`[data-field="${path}"]`);
  el?.focus();
}

function focusFirstError(errors: FieldErrors<CheckoutFormInput>) {
  const first = FOCUS_ORDER.find((path) => hasError(errors, path));
  if (first) focusField(first);
}

/** The whole checkout in one form (sections `#dados`, `#entrega`, `#pagamento`) plus the summary. */
export function CheckoutForm({ initial, lines, priced }: Props) {
  const router = useRouter();
  const finishAuth = useFinishAuth();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Set synchronously on submit: a second click can arrive before React re-renders `pending`.
  const submitting = useRef(false);

  // The cart hands over its CEP, shipping choice and coupon through sessionStorage. It is only a
  // convenience: the server quotes the shipping and checks the coupon again.
  const [draft] = useState(readDraft);
  const [defaults] = useState<CheckoutFormInput>(() => ({
    name: initial.user?.name ?? "",
    email: initial.user?.email ?? "",
    phone: initial.phone,
    cpf: initial.cpf,
    cep: initial.address?.cep ?? draft.cep,
    street: initial.address?.street ?? "",
    number: initial.address?.number ?? "",
    complement: initial.address?.complement ?? "",
    district: initial.address?.district ?? "",
    city: initial.address?.city ?? "",
    state: (initial.address?.state ?? "") as CheckoutFormInput["state"],
    shippingId: draft.shippingId ?? "",
    couponCode: draft.coupon?.code ?? "",
    payment: "pix",
    card: { number: "", holder: "", expiry: "", cvv: "" },
    // Same token for every attempt of this form: a double click or retry gives the same order.
    checkoutToken: crypto.randomUUID(),
    // Optional consent-like choices start off (LGPD).
    saveAccount: false,
    password: "",
  }));

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormInput, unknown, CheckoutFormOutput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: defaults,
    shouldFocusError: false,
  });

  const cep = useWatch({ control, name: "cep" });
  const shippingId = useWatch({ control, name: "shippingId" });
  const password = useWatch({ control, name: "password" }) ?? "";
  const saveAccount = useWatch({ control, name: "saveAccount" });

  const items = lines.map((l) => ({ productId: l.productId, qty: l.qty }));
  const { quotes, error: quoteError, loading: quoting } = useCheckoutQuotes(cep, items);
  // New quotes: keep the choice if it is still offered, else take the cart's choice for this CEP.
  useEffect(() => {
    if (quotes.length === 0) {
      if (!quoting && shippingId) setValue("shippingId", "");
      return;
    }
    if (quotes.some((q) => q.id === shippingId)) return;
    const fromCart =
      onlyDigits(draft.cep) === onlyDigits(cep) && quotes.some((q) => q.id === draft.shippingId)
        ? (draft.shippingId ?? "")
        : "";
    setValue("shippingId", fromCart);
  }, [quotes, quoting, shippingId, cep, draft, setValue]);

  const shipping = quotes.find((q) => q.id === shippingId) ?? null;
  const coupon = draft.coupon && draft.coupon.code === defaults.couponCode ? draft.coupon : null;
  const totals = computeTotals(
    priced,
    shipping ? shipping.priceCents : 0,
    coupon?.discountCents ?? 0,
  );

  const send = (values: CheckoutFormOutput) => {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    startTransition(async () => {
      let result: PlaceOrderResult;
      try {
        // The card never leaves the browser: the server gets a gateway token and the last 4
        // digits. (Mock token; the real gateway tokenizes the card client-side.)
        const { card, password: pass, ...rest } = values;
        const digits = onlyDigits(card?.number ?? "");
        result = await placeOrderAction({
          ...rest,
          ...(values.payment === "cartao"
            ? { cardToken: mockCardToken(digits), cardLast4: digits.slice(-4) }
            : {}),
          ...(values.saveAccount ? { password: pass } : {}),
          lines: useCartStore.getState().lines,
        });
      } catch {
        result = { status: "error", message: GENERIC_ERROR };
      }
      if (result.status === "ok" && result.redirectTo) {
        setDone(true);
        // New account, or already signed in (retry after a partial failure) with a cart that is
        // not marked as this user's yet: sync the owner and refresh the header first.
        const ownerMismatch =
          result.userId !== undefined && useCartStore.getState().owner !== result.userId;
        if (result.accountCreated || ownerMismatch) await finishAuth(result.redirectTo);
        else router.push(result.redirectTo);
        return;
      }
      submitting.current = false;
      const fieldErrors = result.fieldErrors ?? {};
      for (const path of FOCUS_ORDER) {
        const message = fieldErrors[path];
        if (message) setError(path, { message });
      }
      const first = FOCUS_ORDER.find((path) => fieldErrors[path]);
      if (first) focusField(first);
      else setFormError(result.message ?? GENERIC_ERROR);
    });
  };

  const busy = pending || done;
  const summary = {
    lines: priced,
    itemCount: totals.itemCount,
    subtotalCents: totals.subtotalCents,
    totalCents: totals.totalCents,
    shipping,
    coupon,
  };

  return (
    <>
      <SummaryDetails {...summary} />
      <div className="flex flex-wrap items-start gap-8">
        <form
          id="checkout-form"
          noValidate
          onSubmit={(e) => void handleSubmit(send, (invalid) => focusFirstError(invalid))(e)}
          className="flex min-w-0 flex-col gap-6 md:flex-[999_1_560px] md:gap-7"
        >
          <input type="hidden" {...register("checkoutToken")} />
          <input type="hidden" {...register("couponCode")} />
          {initial.user ? null : <AccountBox />}

          <fieldset id="dados" className={cn(section, "scroll-mt-4")}>
            <legend className={legend}>JOGADOR</legend>
            <div className="grid gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-4">
              <Field label="Nome completo" plainLabel error={errors.name?.message}>
                <TextInput autoComplete="name" className={checkoutInput} {...register("name")} />
              </Field>
              <Field label="E-mail" plainLabel error={errors.email?.message}>
                <TextInput
                  type="email"
                  autoComplete="email"
                  className={checkoutInput}
                  {...register("email")}
                />
              </Field>
              <Field label="Celular" plainLabel error={errors.phone?.message}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <MaskedInput
                      mask="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      className={checkoutInput}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onAccept={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Field>
              <Field
                label="CPF"
                plainLabel
                hint="para nota fiscal e antifraude"
                error={errors.cpf?.message}
              >
                <Controller
                  control={control}
                  name="cpf"
                  render={({ field }) => (
                    <MaskedInput
                      mask="cpf"
                      placeholder="000.000.000-00"
                      className={checkoutInput}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onAccept={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset id="entrega" className={cn(section, "scroll-mt-4")}>
            <legend className={legend}>
              <span className="md:hidden">ENTREGA</span>
              <span className="hidden md:inline">ENDEREÇO DE ENTREGA</span>
            </legend>
            <AddressFields
              control={control}
              register={register}
              setValue={setValue}
              errors={{
                cep: errors.cep?.message,
                street: errors.street?.message,
                number: errors.number?.message,
                complement: errors.complement?.message,
                district: errors.district?.message,
                city: errors.city?.message,
                state: errors.state?.message,
              }}
              inputClassName={checkoutInput}
            />

            <div data-field="shippingId" tabIndex={-1} className="flex flex-col gap-2.5">
              <p className="m-0 text-sm">Frete</p>
              {quotes.length > 0 ? (
                <Controller
                  control={control}
                  name="shippingId"
                  render={({ field }) => (
                    <PillRadioGroup
                      label="Opções de frete"
                      value={field.value}
                      onChange={field.onChange}
                      className="flex-col flex-nowrap"
                      optionClassName="w-full"
                      options={quotes.map((q) => ({
                        value: q.id,
                        label: q.service,
                        note: `${q.carrier} · ${q.days} · ${totalLabel(q.priceCents)}`,
                      }))}
                    />
                  )}
                />
              ) : (
                <p
                  role={quoteError ? "alert" : undefined}
                  className={cn(
                    "m-0 text-xs",
                    quoteError ? "text-danger-text" : "text-text-subtle",
                  )}
                >
                  {quoteError === "cep_nao_atendido"
                    ? "CEP não atendido."
                    : quoting
                      ? "Calculando o frete…"
                      : isValidCep(cep)
                        ? "Não foi possível calcular o frete agora."
                        : "Informe o CEP para ver as opções de frete."}
                </p>
              )}
              {errors.shippingId?.message ? (
                <p role="alert" className="m-0 text-xs text-danger-text">
                  {errors.shippingId.message}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset id="pagamento" className={cn(section, "scroll-mt-4")}>
            <legend className={legend}>PAGAMENTO</legend>
            <PaymentPicker control={control} errors={errors} register={register} />
          </fieldset>

          <div className="flex flex-col gap-3">
            {initial.user ? null : (
              <>
                <Controller
                  control={control}
                  name="saveAccount"
                  render={({ field }) => (
                    <Checkbox
                      name={field.name}
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      label={
                        <>
                          Salvar meus dados e criar uma conta para as próximas compras.{" "}
                          <span className="text-text-subtle">(opcional)</span>
                        </>
                      }
                    />
                  )}
                />
                {saveAccount ? (
                  <div className="flex flex-col gap-3.5">
                    <Field label="Crie uma senha" plainLabel error={errors.password?.message}>
                      <TextInput
                        type="password"
                        autoComplete="new-password"
                        className={checkoutInput}
                        {...register("password")}
                      />
                    </Field>
                    <PasswordRules password={password} />
                  </div>
                ) : null}
              </>
            )}
            <p className="m-0 text-xs leading-relaxed text-text-subtle md:text-[13px]">
              Usamos seus dados só para processar e entregar este pedido. Ao continuar você aceita
              os{" "}
              <Link href="/termos" className={inlineLink}>
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className={inlineLink}>
                Política de Privacidade
              </Link>
              .
            </p>
          </div>

          <FormMessage error={formError} />
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            aria-busy={busy}
            className="hidden self-start px-7 py-5 text-[13px] shadow-hard md:inline-flex"
          >
            SAVE GAME <span aria-hidden="true">›</span>
          </Button>
        </form>
        <SummaryAside {...summary} />
      </div>
      <CheckoutBar totalCents={totals.totalCents} pending={busy} />
    </>
  );
}
