import type { CartData } from "@/lib/cart/types";
import type {
  Address,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PixPayment,
  Product,
} from "@/lib/data/types";
import type { ReturnPreference, ReturnReason } from "@/lib/validation/return";
import type { ShopQuery } from "@/lib/shop-query";

export interface CatalogPort {
  list(q: ShopQuery): Promise<{
    items: Product[];
    total: number;
    page: number;
    pageCount: number;
  }>;
  bySlug(slug: string): Promise<Product | null>;
  related(productId: string, limit: number): Promise<Product[]>;
  featured(limit: number): Promise<Product[]>;
  byIds(ids: string[]): Promise<Product[]>;
}

export interface NewsletterPort {
  subscribe(input: {
    email: string;
    consent: true;
    consentVersion: string;
  }): Promise<{ status: "ok" | "already" }>;
}

export interface EngagementPort {
  /** Flips the favorite and returns the new state (true = now a favorite). */
  toggleFavorite(userId: string, productId: string): Promise<boolean>;
  favorites(userId: string): Promise<string[]>;
  requestStockAlert(i: {
    userId: string | null;
    email: string;
    productId: string;
    consentedAt: string;
  }): Promise<void>;
}

export type ShippingQuote = {
  id: string;
  service: string;
  carrier: string;
  /** null = price not defined yet (shown as the `[VALOR]` placeholder). */
  priceCents: number | null;
  /** Delivery deadline text, `"[X] dias"` while the real one is not defined. */
  days: string;
};

export type ShippingError = { error: "cep_invalido" | "cep_nao_atendido" };

export interface ShippingPort {
  quote(i: {
    cep: string;
    items: { productId: string; qty: number }[];
  }): Promise<ShippingQuote[] | ShippingError>;
}

export type CouponResult =
  | { ok: true; code: string; discountCents: number | null; label: string }
  | { ok: false; reason: "invalido" | "expirado" };

export interface CouponPort {
  validate(code: string, subtotalCents: number | null): Promise<CouponResult>;
}

export type AuthUser = { id: string; name: string; email: string };

export type SignUpInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  acceptTerms: true;
  marketingEmail: boolean;
  /** Version of the Terms/Privacy text the user accepted. */
  termsVersion: string;
  /** Saved from the checkout ("save my data"). */
  cpf?: string;
  address?: Address;
};

export type AuthProvider = "google" | "facebook" | "apple";

export type SignUpResult = { status: "confirmacao_pendente"; userId: string | null };
/** null = wrong e-mail or password (the caller must not tell which). */
export type SignInResult = AuthUser | null | { error: "email_nao_confirmado" };
export type EmailLinkType = "email" | "recovery";

/** Accounts and the session. The adapter owns the session cookies; callers never see them. */
export interface AuthPort {
  /** Creates the session on success; `remember` keeps it for 30 days (else a browser session). */
  signIn(email: string, password: string, remember: boolean): Promise<SignInResult>;
  /** userId null = the e-mail already had an account (nothing else changes for the caller). */
  signUp(i: SignUpInput, next: string): Promise<SignUpResult>;
  signInWithProvider(p: AuthProvider, next: string): Promise<{ url: string }>;
  /** true = session created. */
  completeOAuth(code: string): Promise<boolean>;
  /** true = link valid; for "email" signs the user in, for "recovery" opens a recovery session. */
  verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<boolean>;
  /** Resolves the same way whether or not the e-mail has a pending account. */
  resendConfirmation(email: string, next: string): Promise<void>;
  /** Resolves the same way whether or not the e-mail has an account. */
  requestPasswordReset(email: string): Promise<void>;
  /** Needs the recovery (or a normal) session; signs every other session out. */
  updatePassword(next: string): Promise<{ ok: boolean }>;
  signOut(): Promise<void>;
  /** The signed-in user; null without a session or when the account is gone. */
  currentUser(): Promise<AuthUser | null>;
  savedCart(userId: string): Promise<CartData | null>;
  saveCart(userId: string, cart: CartData): Promise<void>;
}

export interface RateLimitPort {
  /** Counts one attempt for `key` in a fixed window; false = over `max` (the caller must refuse). */
  hit(key: string, max: number, windowSeconds: number): Promise<boolean>;
}

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  avatarUrl: string | null;
};

export type ConsentType = "email_marketing" | "terms" | "privacy";

/** One entry of the append-only consent history: a grant or a revocation, never edited. */
export type ConsentRecord = {
  type: ConsentType;
  granted: boolean;
  /** Version of the text the user agreed to. */
  version: string;
  grantedAt: string;
  revokedAt: string | null;
};

export type Connection = { provider: AuthProvider; email: string | null };

/** Everything stored about one user (LGPD art. 18, portability). Also matched by profile e-mail. */
export type AccountExport = {
  exportedAt: string;
  profile: { id: string; name: string; email: string; phone: string; cpf: string | null };
  addresses: Address[];
  consents: ConsentRecord[];
  connections: Connection[];
  favorites: string[];
  orders: Order[];
  returns: {
    protocol: string;
    orderId: string;
    reason: string;
    description: string;
    preference: string;
    photos: { name: string; type: string; size: number }[];
  }[];
  stockAlerts: { email: string; productId: string; consentedAt: string }[];
  newsletter: { email: string; consentVersion: string } | null;
  savedCart: CartData | null;
};

/** Everything the signed-in user manages in "Minha conta". Every call is scoped to `userId`. */
export interface AccountPort {
  /** null = unknown user. */
  profile(userId: string): Promise<Profile | null>;
  updateProfile(
    userId: string,
    p: { name: string; phone: string; cpf?: string | null },
  ): Promise<void>;
  /** `ok: false` when the current password is wrong. */
  changePassword(userId: string, current: string, next: string): Promise<{ ok: boolean }>;
  addresses(userId: string): Promise<Address[]>;
  /** With an `id` of the user it edits that address, otherwise it adds one. The first is the default. */
  upsertAddress(userId: string, a: Address): Promise<Address>;
  deleteAddress(userId: string, id: string): Promise<void>;
  setDefaultAddress(userId: string, id: string): Promise<void>;
  /** The whole history, oldest first. */
  consents(userId: string): Promise<ConsentRecord[]>;
  /** Appends a record (a grant, or a revocation with `revokedAt`); old records are never touched. */
  setConsent(
    userId: string,
    type: "email_marketing",
    granted: boolean,
    /** Version of the text shown to the user right now. */
    version: string,
  ): Promise<void>;
  connections(userId: string): Promise<Connection[]>;
  connect(userId: string, provider: AuthProvider): Promise<void>;
  /** `ok: false` when it is the last way to sign in (no password and only this provider). */
  disconnect(userId: string, provider: AuthProvider): Promise<{ ok: boolean }>;
  /** null = unknown user. */
  exportData(userId: string): Promise<AccountExport | null>;
  /**
   * `ok: false` (and nothing deleted) when the password is wrong. Besides the account it removes
   * return requests, stock alerts and the newsletter subscription made with the profile e-mail.
   */
  deleteAccount(userId: string, password: string): Promise<{ ok: boolean }>;
}

export interface AddressLookupPort {
  /** Street data for a CEP; null = unknown CEP (the user types the address). */
  byCep(cep: string): Promise<Omit<Address, "number" | "complement"> | null>;
}

export type CreateOrderInput = {
  userId: string | null;
  guestToken: string | null;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotalCents: number | null;
  shippingCents: number | null;
  discountCents: number;
  totalCents: number | null;
  shippingAddress: Address;
  customer: Customer;
  shippingService: string;
};

export type OrderViewer = { userId: string | null; guestTokens: string[] };

export interface OrdersPort {
  /** The same idempotency key always gives back the same order. */
  create(i: CreateOrderInput, idempotencyKey: string): Promise<Order>;
  /** null when the viewer does not own the order (simulates RLS). */
  get(id: string, viewer: OrderViewer): Promise<Order | null>;
  listForUser(userId: string): Promise<Order[]>;
  setStatus(id: string, s: OrderStatus): Promise<void>;
}

/** Token the browser got from the gateway in place of the card data, plus the last 4 digits. */
export type CardInput = { token: string; last4: string };

export interface PaymentsPort {
  /**
   * Starts the payment of an order that is awaiting payment. Asking again for the same method
   * gives back the same payment; another method replaces it (e.g. Pix after a declined card).
   * A card needs its token and may come back `recusado` (the order stays awaiting payment).
   */
  start(orderId: string, method: PaymentMethod, card?: CardInput): Promise<Payment>;
  /** New 30 minute window for an expired Pix. */
  renewPix(orderId: string): Promise<PixPayment>;
  status(orderId: string): Promise<OrderStatus>;
}

export type CreateReturnInput = {
  orderId: string;
  reason: ReturnReason;
  description: string;
  preference: ReturnPreference;
  photos: File[];
};

export type CreateReturnError = {
  error:
    | "pedido_nao_encontrado" // not the user's order (or unknown)
    | "pedido_indisponivel" // not shipped yet
    | "fora_do_prazo"; // "arrependimento" after 7 days from delivery
};

export interface ReturnsPort {
  /** Protocol is `T-` plus 4 sequential digits. The order must belong to `userId`. */
  create(userId: string, i: CreateReturnInput): Promise<{ protocol: string } | CreateReturnError>;
}

export type Ports = {
  catalog: CatalogPort;
  newsletter: NewsletterPort;
  engagement: EngagementPort;
  shipping: ShippingPort;
  coupons: CouponPort;
  auth: AuthPort;
  account: AccountPort;
  addressLookup: AddressLookupPort;
  orders: OrdersPort;
  payments: PaymentsPort;
  returns: ReturnsPort;
  rateLimit: RateLimitPort;
  // other ports are added by the tasks that use them
};
