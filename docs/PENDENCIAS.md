# Pendências e decisões em aberto

Tudo o que o frontend deixou como placeholder, decisão adiada ou obrigação do backend.
A interface nunca inventa preço, prazo, dado da empresa nem texto jurídico: o que falta aparece como `[PLACEHOLDER]` (regras no `CLAUDE.md`).
Este documento é o ponto de partida do plano de backend.

## 1. Dados que só o dono pode fornecer

| Item                              | Onde aparece hoje                                                                                        | O que falta                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Preços dos produtos               | `[PREÇO]` em cards, ficha do produto e carrinho (fixtures com `priceCents: null`)                        | Preço de cada item                                               |
| Valores e totais                  | `[VALOR]` no resumo do carrinho, checkout e pedidos                                                      | Saem sozinhos quando os preços existirem                         |
| Prazos de entrega                 | `[X] dias` na cotação de frete e nas páginas de política                                                 | Prazo de produção e prazo por transportadora                     |
| Frete grátis                      | `[Faltam R$ X para frete grátis]`; `NEXT_PUBLIC_FREE_SHIPPING_CENTS` vazia                               | Valor mínimo (em centavos) ou decisão de não ter                 |
| CNPJ e razão social               | `[razão social]` e `[00.000.000/0000-00]` no rodapé, privacidade e termos                                | Dados da empresa                                                 |
| Encarregado de dados (LGPD)       | `[privacidade@seudominio.com.br]` na política de privacidade                                             | Nome e e-mail do encarregado                                     |
| Usuário do Instagram              | `[usuario]` quando `NEXT_PUBLIC_INSTAGRAM_USER` está vazia                                               | Usuário real (e número do WhatsApp, se o canal mudar)            |
| Texto "Sobre"                     | A home tem a seção `#sobre` com o placeholder `[texto "Sobre"]`; não existe página própria               | Texto da marca (e decidir se vira página)                        |
| Fotos extras e medidas            | Produtos ilustrativos usam arte em pixels (`images: []`); medidas são placeholders                       | Fotos reais (galeria) e medidas de cada item                     |
| Parcelas                          | `[parcelas]` na opção CARTÃO do checkout                                                                 | Regra de parcelamento (número de parcelas, juros)                |
| Limite de fotos da troca          | `MAX_RETURN_PHOTO_BYTES` = 5 MB por foto, até 4 fotos (`lib/validation/return.ts`)                       | Confirmar com o dono (uma constante)                             |
| Limite do corpo da Server Action  | `serverActions.bodySizeLimit: "21mb"` em `next.config.ts` (4 x 5 MB mais folga para os campos)           | Mudar junto com o limite de fotos                                |
| Faixa de preço da loja            | O filtro de faixa de preço está oculto (não há preços)                                                   | Reativar quando existirem preços                                 |
| Favoritos sem página              | O coração grava o favorito, mas não existe tela "Favoritos" (o item fica oculto no menu de `/conta`)     | Decidir se a página entra (`EngagementPort.favorites` já existe) |
| Login com Apple                   | Botão atrás de `NEXT_PUBLIC_AUTH_APPLE` (padrão `false`)                                                 | Conta Apple Developer e configuração no Supabase                 |
| Remetente dos e-mails de login    | `admin_email` e `sender_name` = `[PLACEHOLDER]` em `[auth.email.smtp]` (`supabase/config.toml`)          | Domínio e endereço do remetente; credenciais SMTP do Resend      |
| Logo                              | O cabeçalho usa a grade de pixels provisória (`LOGO_ROWS`); o conceito está em `docs/design/referencia/` | Arte final da logo                                               |
| Revisão jurídica                  | Privacidade, Termos e Trocas são rascunhos (`content/legal/*.mdx`, comentários `RASCUNHO`)               | Advogado revisar antes de publicar (ver lista abaixo)            |
| Meta description de `/encomendas` | Texto escrito pelo implementador, não veio do design                                                     | O dono aprovar ou reescrever                                     |
| Descrições das fixtures           | Derivadas dos textos alternativos do design (neutras, sem promessa)                                      | Descrição real de cada produto                                   |

Pontos que a revisão jurídica precisa cobrir:

- rótulo do consentimento da newsletter (texto curto, com link para `/privacidade`) e sua versão `NEWSLETTER_CONSENT_VERSION`;
- a política de privacidade deve listar e-mail e registro de consentimento da newsletter;
- aviso de termos do checkout ("Salvar meus dados e criar conta"), que cria a conta sem caixa de aceite explícita;
- AVISE-ME de usuário logado: o clique conta como consentimento afirmativo, com aviso de uma linha e link para a privacidade (sem caixa marcável);
- textos de Trocas e devoluções, incluindo os prazos.

Lacunas entre o que a política de privacidade lista e o que o código coleta hoje (o texto jurídico não foi alterado; o advogado precisa reconciliar):

- o checkout sempre exige CPF, enquanto a política diz "apenas quando necessário";
- e-mail e consentimento da newsletter (ver acima);
- e-mails de visitantes no AVISE-ME de estoque (sem conta);
- fotos e descrições dos pedidos de troca e devolução;
- carrinho salvo no servidor para quem tem conta;
- cookie `pp_guest_orders` (pedidos de convidado) e o carrinho em `localStorage` (`pp_cart_v1`).

## 2. Decisões de design para o dono

- **Botão do Facebook em `#166FE5`.** O azul de marca não atinge contraste AA com texto branco; a regra de acessibilidade do `CLAUDE.md` vale mais que o hex da marca. Trocar é uma linha.
- **Cores dos status de pedido.** `Perfil.dc.html` (ENTREGUE em amarelo, EM ANÁLISE em roxo) conflita com `Pedidos.dc.html`. Venceu `Pedidos.dc.html`, e a fonte única é `orderStatusView`. Confirmar qual está certo.
- **Datas das fixtures.** Os pedidos de teste mostram datas reais (ex.: 01/08/2026). São dados de desenvolvimento, nunca de produção; as datas reais virão do backend. Se preferir, trocar a exibição por `[00/00/0000]`.
- **Acentos em Press Start 2P.** A fonte pixelada não desenha bem alguns acentos maiúsculos (Í, Ú). O dono aceitou o fallback em Silkscreen (traço mais fino nas letras acentuadas), que fica registrado aqui. O caso de teste é `tests/e2e/fonte.spec.ts`.
- **Cidade e UF em campos separados.** O design mostra "Cidade / UF"; o formulário separa os dois por usabilidade (o ViaCEP devolve os dois e o frete precisa da UF). Aceito; reverter só se o dono quiser o layout literal.
- **Extras do carrinho e do checkout.** Botão APLICAR do cupom, rascunho de cupom restaurado, cupom sempre aberto no celular e `PillRadioGroup` para o frete não estão no design. Aceitos por usabilidade.
- **Gaveta "Continuar".** No desktop o design usa o link "Continuar comprando" em Space Mono 14px; a implementação usa `‹ CONTINUAR JOGANDO` (microcopy do glossário do briefing) em fonte pixel, sem sombra. Manter ou alinhar.
- **Newsletter.** O formulário tem 520 px como no design; o cartão que o envolve tem 720 px com fundo `surface` (vem da tela de parallax). Aceito.
- **Tela "Confira seu e-mail" do cadastro** (`/cadastro/confirme-seu-email`). Não existe nos `.dc.html`: usa o cartão do estado "enviado" de `/entrar?modo=recuperar`, com o e-mail mascarado (`a***@teste.dev`), o botão REENVIAR LINK e o link ‹ VOLTAR PARA ENTRAR. O botão REENVIAR LINK também aparece no login de conta não confirmada. Confirmar o visual.
- **Tela `/redefinir-senha`.** Não existe nos `.dc.html`: usa o cabeçalho e o cartão de `/entrar?modo=recuperar` (NOVA SENHA / CRIE SUA SENHA), os campos "Nova senha" e "Confirmar nova senha" com as regras ao vivo do cadastro e o botão SALVAR NOVA SENHA; ao salvar vai para `/conta` com o toast "Senha alterada.". Também abre quando alguém confirma uma conta pendente que foi cadastrada de novo (a senha foi trocada por uma aleatória). O aviso "Link inválido ou expirado. Peça um novo." de `/entrar?erro=link` é um quadro com borda `danger` acima do login. Confirmar o visual.
- **E-mails de confirmação e de nova senha** (`supabase/templates/`). Textos escritos pelo implementador no tom da marca, sem prazo de validade do link. O dono aprovar ou reescrever.

## 3. Obrigações do backend (o mock não cobre)

- **Pedidos órfãos.** "Tentar de novo" ou trocar a forma de pagamento cria um pedido novo e o antigo continua em `aguardando_pagamento`. O backend precisa expirar/cancelar pedidos não pagos (job agendado) e devolver o estoque.
- **`checkoutToken` é segredo.** Hoje ele funciona como chave ao portador para ver o pedido de um convidado. Tratar como segredo (não logar, não pôr em URL) e, no adaptador real, exigir também que o `userId` confira quando houver sessão.
- **Contrato do `ReturnsPort`.** `create` devolve `{ protocol } | CreateReturnError` (união tipada, não lança exceção). O adaptador real precisa seguir isso: erros `pedido_nao_encontrado`, `pedido_indisponivel` e `fora_do_prazo`; protocolo no formato `T-0001`. A mensagem de `pedido_indisponivel` é neutra e serve mal para pedidos cancelados ou reembolsados.
- **Prazo de 90 dias para defeito.** Só o prazo de arrependimento (7 dias após a entrega) é verificado. O prazo de 90 dias para vício aparente não é aplicado em lugar nenhum.
- **Exportação e exclusão de conta (`exportData`, `deleteAccount`).** O mock exporta (tipo `AccountExport`) e apaga perfil, endereços, consentimentos, conexões, favoritos, carrinho salvo, pedidos de troca, avisos de estoque (por usuário e pelo e-mail do perfil) e a inscrição da newsletter (pelo e-mail). Pedidos ficam anonimizados (nome, e-mail, telefone e CPF viram `[removido]`), mas o endereço de entrega e os pedidos de redefinição de senha seguem sem anonimizar. O adaptador real deve cobrir as mesmas coleções nos dois métodos. Definir a retenção (pedidos precisam ser guardados por obrigação fiscal; o resto deve ser apagado ou anonimizado) e refletir na política de privacidade.
- **E-mail de marketing tem duas fontes de verdade.** O formulário da home grava `store.newsletter` por e-mail, e `/conta` grava consentimentos `email_marketing` por usuário. Decisão do backend: um único registro de consentimento de marketing, por usuário ou por e-mail, com data/hora e versão do texto em cada registro de newsletter, e o interruptor de `/conta` refletindo e revogando a inscrição da newsletter.
- **Seals do `iron-session` não são revogados.** O cookie é sem estado: sair da conta ou trocar a senha não invalida um seal já emitido (vale até 30 dias). O backend precisa de versão de sessão ou lista de revogação.
- **`pp_guest_orders` sobrevive ao logout.** Em dispositivo compartilhado, o cookie com os pedidos de convidado continua legível depois de sair. Limpar no logout e/ou expirar mais cedo.
- **Upload de fotos da troca.** `bodySizeLimit: "21mb"` vale para todas as Server Actions. O backend deve usar upload direto assinado (Supabase Storage) e restaurar o limite padrão.
- **Analytics (Umami).** O script do Umami precisa de `data-website-id`, que `ConsentScripts` não consegue definir (só recebe `NEXT_PUBLIC_ANALYTICS_SRC`). As variáveis `UMAMI_*` do `docker-compose.yml` (`UMAMI_DB_USER`, `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET`) também não estão no `.env.example`.
- **Usuário só com provedor social não consegue excluir a conta.** `deleteAccount` exige a senha, e quem entrou só com Google/Facebook tem senha vazia. Também não consegue definir senha, embora o erro de `disconnect` diga "Crie uma senha". O adaptador real precisa de um caminho (reautenticação pelo provedor ou criação de senha).
- **Cache das páginas de produto.** Os triggers de `products` chamam `POST /api/revalidate` (pg_net) com os slugs alterados, mas só quando o Vault do projeto tem os segredos `site_url` e `revalidate_secret` (o mesmo valor de `REVALIDATE_SECRET`). Criar os dois em cada ambiente (`select vault.create_secret(...)`); sem eles o catálogo só muda quando o cache expira.
- **Cartão.** O servidor nunca recebe número nem CVV, só um token do gateway (`CardInput`). Manter: tokenização no navegador (Mercado Pago).
- **Limite de tentativas.** O cadastro revela se o e-mail já tem conta e não há rate limit; limitar login, cadastro e recuperação de senha.
- **Webhook do Mercado Pago** com assinatura verificada e idempotência (o mock não simula).
- **Conta criada com o e-mail de outra pessoa (risco residual).** Quem se cadastra sozinho com o e-mail de outra pessoa sabe a senha da conta se essa pessoa clicar no link de confirmação que não pediu. Um segundo cadastro para o mesmo e-mail pendente já faz a confirmação trocar a senha por uma aleatória e pedir uma nova. Mitigações para depois: sempre pedir uma senha nova depois de confirmar o e-mail, ou cadastro sem senha (link mágico).

## 4. Dívida técnica conhecida

- **`npm audit`:** `fast-uri` 3.1.8 (moderado, 4 GHSA) entra via `@hookform/resolvers` → `ajv`. Não vem do MDX. Rodar `npm audit fix` antes do lançamento, respeitando `min-release-age=14`.
- Os testes visuais usam tolerância de 1% (`maxDiffPixelRatio`), que esconde mudanças pequenas de glifo; `fonte-acentos` merece tolerância menor.
- `tests/e2e/support/hydration.ts` depende da chave interna `__reactProps` do React.
- Versões de consentimento (todas `2026-10-28`) precisam ser incrementadas à mão quando o texto correspondente mudar: `AUTH_CONSENT_VERSION` (termos e privacidade no cadastro, `lib/validation/auth.ts`), `CHECKOUT_CONSENT_VERSION` (aviso do checkout, `lib/validation/checkout.ts`), `NEWSLETTER_CONSENT_VERSION` (caixa da newsletter, `lib/validation/newsletter.ts`) e `MARKETING_CONSENT_VERSION` (interruptor de e-mail em `/conta` e caixa de marketing do cadastro, `lib/validation/account.ts`).
- `DATA_SOURCE` é obrigatória (sem padrão): ela liga as rotas `/api/__mock__/*`. O `.env.example`, o `webServer` do Playwright e o Vitest já a definem; todo deploy precisa defini-la.
- Rótulos de 7 px do TabBar seguem o design; o contraste passa em AA (texto `accent` sobre `surface`, cerca de 6:1), mas o tamanho é pequeno.

## 5. Ports a implementar no plano de backend

Todos em `lib/data/ports.ts`; hoje só existe o adaptador mock (`lib/data/mock/`). `getData()` em `lib/data/index.ts` escolhe o adaptador por `DATA_SOURCE` e hoje só aceita `mock`.

| Port                | Serviço previsto                                         |
| ------------------- | -------------------------------------------------------- |
| `CatalogPort`       | Supabase (Postgres, com tags de revalidação)             |
| `NewsletterPort`    | Supabase + Resend                                        |
| `EngagementPort`    | Supabase (favoritos e avisos de estoque, com RLS)        |
| `ShippingPort`      | Melhor Envio                                             |
| `CouponPort`        | Supabase                                                 |
| `AuthPort`          | Supabase Auth (e-mail, Google, Facebook, Apple)          |
| `AccountPort`       | Supabase (perfil, endereços, consentimentos, exportação) |
| `AddressLookupPort` | ViaCEP                                                   |
| `OrdersPort`        | Supabase (idempotência por chave, RLS por usuário)       |
| `PaymentsPort`      | Mercado Pago (Pix, cartão, boleto) + webhook             |
| `ReturnsPort`       | Supabase Storage (fotos) + Resend                        |
| analytics           | Umami ou Plausible via `NEXT_PUBLIC_ANALYTICS_SRC`       |

Assinaturas atuais, copiadas de `lib/data/ports.ts`:

```ts
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

export interface AuthPort {
  /** null = wrong e-mail or password (the caller must not tell which). */
  signIn(email: string, password: string): Promise<AuthUser | null>;
  signUp(i: SignUpInput): Promise<AuthUser | { error: "email_em_uso" }>;
  signInWithProvider(p: AuthProvider): Promise<AuthUser>;
  /** Resolves the same way whether or not the e-mail has an account. */
  requestPasswordReset(email: string): Promise<void>;
  /** Turns a session cookie into a user; null if the account is gone. */
  userById(id: string): Promise<AuthUser | null>;
  savedCart(userId: string): Promise<CartData | null>;
  saveCart(userId: string, cart: CartData): Promise<void>;
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
  // other ports are added by the tasks that use them
};
```
