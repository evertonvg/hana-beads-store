# Backend 1/4 — Fundação Supabase, Catálogo e Auth — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com `DATA_SOURCE=supabase`, os ports de catálogo, auth, CEP, newsletter e engajamento passam a usar o Supabase (com confirmação de e-mail obrigatória e RLS testado), e o modo `mock` continua funcionando com a suíte E2E atual verde.

**Architecture:** A pasta `supabase/` (migrations, seed, templates, testes pgTAP) fica neste repositório. Os adaptadores reais ficam em `lib/data/supabase/`, um por port, e recebem a fábrica de cliente por injeção (`{ getClient }`), o que permite rodar os mesmos testes de contrato contra o mock e contra o Supabase local. A sessão vira responsabilidade do `AuthPort`: o adaptador Supabase usa os cookies do `@supabase/ssr`, e o adaptador mock mantém o selo do `iron-session` (só no mock).

**Tech Stack:** Supabase CLI (`supabase`, devDependency) · `@supabase/supabase-js` 2 · `@supabase/ssr` 0.12 · Postgres 17 + pgTAP + `pg_net` + Vault + `unaccent` · `basejump supabase_test_helpers` (vendorizado em `supabase/tests/`) · Next.js 16.4 (`cacheComponents`, `'use cache'` + `cacheTag`) · Vitest 5 · Playwright 1.64 · Mailpit (sobe com `supabase start`) · GitHub Actions + `supabase/setup-cli`.

**Spec:** `docs/superpowers/specs/2026-11-07-supabase-foundation-catalog-auth-design.md`

## Global Constraints

- npm 11 com `.npmrc` `min-release-age=14` e `save-exact=true`: instalar **sem** fixar versão (`npm i pacote`) e deixar o npm escolher a mais nova com 14+ dias.
- Branch de trabalho: `feat/supabase-foundation`, saída da `main`.
- Commits convencionais; acrescentar os escopos `db` e `spec` em `commitlint.config.mjs` (Task 1).
- RLS ligado em **todas** as tabelas de `public`, sem exceção.
- A `service_role` / secret key é importada **só** por `lib/supabase/admin.ts` e `lib/supabase/auth-client.ts`, ambos com `import "server-only"`.
- Os logs nunca levam token, `token_hash`, senha, CPF nem o corpo de requisições de auth.
- Erro esperado volta como valor tipado; falha de infraestrutura lança exceção.
- A interface nunca inventa preço, prazo, dado da empresa nem texto jurídico: o remetente dos e-mails é `[PLACEHOLDER]`.
- Telas novas: tamanhos 1280 e 390, axe sem violações, componentes de `/entrar` e `/recuperar-senha`, microcopy no tom do glossário do briefing.
- Constantes de limite de tentativas: 5 por 15 min por e-mail, 20 por 15 min por IP.
- "Manter conectado": 30 dias (`REMEMBER_MAX_AGE = 2_592_000` s); sem a opção, cookie de sessão do navegador.
- Desvio da spec (aprovado ao revisar este plano): o `iron-session` **continua**, mas só dentro do adaptador mock (`lib/data/mock/session-cookie.ts`); `SESSION_SECRET` passa a ser exigido apenas com `DATA_SOURCE=mock`.
- Desvio da spec (aprovado ao revisar este plano): no modo `supabase`, o `AccountPort` usa uma ponte de leitura (`profile`, `addresses`, `consents`, `connections`) para `/conta` abrir. As escritas lançam `NotAvailableYetError` até o sub-projeto 3.

## Review Focus

- **Link de confirmação reutilizado, expirado ou adulterado:** `/auth/confirm` redireciona para `/entrar?erro=link`, com a mensagem "Link inválido ou expirado. Peça um novo.", nunca 500 (teste na Task 11).
- **`next` adulterado no link do e-mail ou no callback do OAuth** (`//evil.com`, `https://evil.com`, `%2F%2Fevil.com`): sempre passa por `safeNext` e cai em `/conta` (teste na Task 11).
- **Busca com caracteres especiais e acentos** (`coração`, `CORACAO`, `100%`, `a_b`, `'; drop`): sem erro de SQL e com o mesmo resultado do mock (contrato na Task 6).
- **E-mail com maiúsculas e espaços** em cadastro, newsletter e aviso de estoque: normalizado igual no mock e no Supabase; `" Ana@Teste.dev "` já inscrito volta `already` (contrato nas Tasks 8 e 9).
- **Token de acesso expirado com refresh token válido** numa navegação comum: o proxy renova a sessão e `getSession()` continua devolvendo o usuário, sem deslogar (integração na Task 7).

---

### Task 1: Ferramental Supabase e variáveis de ambiente

**Files:**

- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/seed.sql` (vazio por enquanto)
- Modify: `package.json` (scripts e dependências), `lib/env.ts`, `.env.example`, `commitlint.config.mjs`, `vitest.config.ts`, `.gitignore`
- Test: `tests/unit/env.test.ts`

**Interfaces:**

- Produces: `serverEnvSchema` com `DATA_SOURCE: "mock" | "supabase"`, `SESSION_SECRET?` (obrigatório se mock), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `REVALIDATE_SECRET` (min 32), `CLIENT_IP_HEADER` (padrão `"x-forwarded-for"`), todas obrigatórias se supabase. Scripts: `db:start`, `db:stop`, `db:reset`, `db:test`, `db:types`, `test:integration`.

- [ ] **Step 1: Testes que falham em `tests/unit/env.test.ts`**

```ts
it("accepts supabase with its variables", () => {
  expect(
    serverEnvSchema.safeParse({
      DATA_SOURCE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      SUPABASE_SECRET_KEY: "sb_secret_x",
      REVALIDATE_SECRET: "r".repeat(32),
    }).success,
  ).toBe(true);
});
it("rejects supabase without SUPABASE_SECRET_KEY", () => {
  /* success false */
});
it("rejects mock without SESSION_SECRET", () => {
  /* success false */
});
it("defaults CLIENT_IP_HEADER to x-forwarded-for", () => {
  /* parsed.CLIENT_IP_HEADER === "x-forwarded-for" */
});
```

- [ ] **Step 2:** `npm test -- tests/unit/env.test.ts` → FAIL (`"supabase"` não está no enum).
- [ ] **Step 3: Implementar** — `serverEnvSchema` passa a ser um objeto com os campos opcionais e um `superRefine` que exige os campos de cada modo. Para o `createEnv` continuar funcionando com `.shape`, exportar `serverEnvShape` (os campos) e aplicar a regra cruzada em `createEnv({ ..., createFinalSchema })`, ou validar com `serverEnvSchema.parse(process.env)` logo depois. A escolha fica com quem implementa, desde que os testes passem e um deploy sem as variáveis falhe no boot.
- [ ] **Step 4: Ferramental**
  - `npm i @supabase/supabase-js @supabase/ssr` e `npm i -D supabase`
  - `npx supabase init` (responder não para as configurações de VS Code/Deno)
  - Em `package.json`: `"db:start": "supabase start"`, `"db:stop": "supabase stop"`, `"db:reset": "supabase db reset"`, `"db:test": "supabase test db"`, `"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts"`, `"test:integration": "vitest run --project integration"`
  - Em `vitest.config.ts`: novo projeto `integration` (`include: ["tests/integration/**/*.test.ts"]`, `environment: "node"`, `env` com as URLs e chaves locais lidas de `process.env`, `fileParallelism: false`). Excluir `tests/integration` dos projetos `node`/`jsdom`.
  - `commitlint.config.mjs`: acrescentar `"db"` e `"spec"`.
  - `.env.example`: bloco Supabase com os valores locais documentados (obtidos de `npx supabase status -o env`) e o comentário de que `SESSION_SECRET` vale só para o mock.
- [ ] **Step 5:** `npm test -- tests/unit/env.test.ts` → PASS; `npm run db:start` sobe sem erro (antes, rodar `wsl --shutdown` e reiniciar o Docker, se for o primeiro boot do dia).
- [ ] **Step 6: Commit** `chore(tooling): add supabase cli, env modes and db scripts`

---

### Task 2: Migration do catálogo, seed e pgTAP

**Files:**

- Create: `supabase/migrations/<ts>_catalog.sql`, `supabase/tests/000-setup-tests-hooks.sql` (instalação do `supabase_test_helpers`, conforme o README do pacote), `supabase/tests/010-products.test.sql`, `scripts/fixtures-to-seed.ts`
- Modify: `supabase/seed.sql`

**Interfaces:**

- Produces: tabela `public.admins (user_id uuid primary key references auth.users on delete cascade)` e `public.is_admin() returns boolean` (`security definer`, `stable`, `set search_path = ''`), criadas aqui porque a política de escrita de `products` depende delas (as políticas de `admins` e seus testes ficam na Task 3); tabela `public.products` (colunas da spec §4); RPC `public.search_products(p_categoria text, p_q text, p_cores text[], p_disponivel boolean, p_ordem text, p_pagina int, p_page_size int) returns table(item jsonb, total bigint)`.

- [ ] **Step 1: pgTAP que falha (`010-products.test.sql`)**: `plan(...)`; `has_table('public','products')`; como `anon` (`tests.clear_authentication()`), `select count(*)` só enxerga os `published = true`; `throws_ok` para INSERT/UPDATE/DELETE como `anon` e como usuário autenticado comum (`tests.authenticate_as`); check rejeita `categories = '{xyz}'`, `colors = '{azul}'` e `stock = -1`; `search_products(null,'coracao',...)` encontra o produto com "CORAÇÃO" no nome; `search_products(null,'100%',...)` e `('a_b')` não dão erro e devolvem 0 linhas; `p_ordem = 'menor'` deixa os `price_cents null` por último.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3: Migration**
  - `create extension if not exists unaccent with schema extensions;` mais um wrapper `public.immutable_unaccent(text)` (`immutable`, `parallel safe`) para a coluna gerada.
  - `products` conforme a spec §4. `search tsvector generated always as (to_tsvector('simple', immutable_unaccent(name || ' ' || category_label))) stored`, com índice GIN. Como o mock compara por **substring** (`includes`), a RPC filtra por `immutable_unaccent(lower(name)) like '%' || escape_like(immutable_unaccent(lower(p_q))) || '%'` (o mesmo vale para `category_label`), escapando `%`, `_` e `\`. A coluna `search` fica disponível para o futuro, mas o contrato segue o mock.
  - Ordenação idêntica a `filterProducts`: `destaque` = `featured_rank nulls last, name collate "pt-BR-x-icu"`; `novo` = `is_new desc`, empatando pela ordem do catálogo (`created_at, id`); `menor`/`maior` = `price_cents nulls last`. A "ordem do catálogo" é `created_at, id`, e o seed insere na ordem das fixtures.
  - `p_pagina` é limitada a `[1, pageCount]` como no mock; `total` vem de `count(*) over ()`.
  - RLS: `select using (published)`; `insert/update/delete` com `is_admin()`. `grant execute on function search_products to anon, authenticated`.
  - Trigger `set_updated_at`.
- [ ] **Step 4: Seed** — `scripts/fixtures-to-seed.ts` (rodado com `node --experimental-strip-types`) lê `lib/data/mock/fixtures.ts` e escreve os `insert` dos 9 produtos em `supabase/seed.sql`, com o `id` das fixtures mapeado para UUIDs determinísticos (`uuid v5` com namespace fixo, para os testes poderem referenciá-los) e `price_cents null`. O script é versionado e a saída também.
- [ ] **Step 5:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 6: Commit** `feat(db): products table, search rpc, seed and rls tests`

---

### Task 3: Perfis, admins, endereços, consentimentos e trigger de cadastro

**Files:**

- Create: `supabase/migrations/<ts>_accounts.sql`, `supabase/tests/020-accounts.test.sql`
- Modify: `supabase/seed.sql` (admin de desenvolvimento `admin@pixelperfect.local` / senha `Admin@12345`, só local, e a usuária `ana@teste.dev` / `Senha@123`, confirmada, para os E2E)

**Interfaces:**

- Consumes: `admins` e `is_admin()` (Task 2).
- Produces: `profiles`, `addresses`, `consents` (spec §4); políticas de `admins`; trigger `on_auth_user_created` → `public.handle_new_user()`, que lê de `raw_user_meta_data` as chaves `name`, `phone`, `cpf?`, `terms_version`, `marketing_email` (boolean), `marketing_version?`, `address?` (objeto no formato `Address`).

- [ ] **Step 1: pgTAP que falha**: inserir em `auth.users` com metadados completos cria `profiles` (nome e telefone), 2 `consents` (`terms` e `privacy` com `terms_version`) mais `email_marketing` quando `marketing_email = true`, e 1 `addresses` com `is_default = true` quando vem `address`; metadados com `name` vazio ou `address.state` com mais de 2 letras **não** derrubam o cadastro (o campo inválido é ignorado e o perfil sai com nome `""`); usuário A não lê nem altera `profiles`/`addresses`/`consents` de B; ninguém faz UPDATE/DELETE em `consents` (nem o dono); só admin lê `admins`; autenticado comum não consegue se inserir em `admins`; `is_admin()` é true só para o admin do seed.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3: Migration** — tabelas e políticas conforme a spec §4. `handle_new_user` com `security definer`, `set search_path = ''`, validando tamanho e formato de cada campo (CEP com 8 dígitos, UF `^[A-Z]{2}$`, CPF com 11 dígitos, telefone até 20 caracteres); o que não passa é descartado. `profiles.id references auth.users on delete cascade`.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat(db): profiles, admins, addresses, consents and signup trigger`

---

### Task 4: Engajamento, newsletter, carrinho salvo e limite de tentativas

**Files:**

- Create: `supabase/migrations/<ts>_engagement.sql`, `supabase/tests/030-engagement.test.sql`, `supabase/tests/090-rls-everywhere.test.sql`

**Interfaces:**

- Produces: tabelas `favorites`, `stock_alerts`, `newsletter_subscriptions`, `saved_carts`, `rate_limits`; RPCs `subscribe_newsletter(p_email text, p_consent_version text) returns text` (`'ok' | 'already'`), `request_stock_alert(p_email text, p_product_id uuid, p_consented_at timestamptz) returns void`, `toggle_favorite(p_product_id uuid) returns boolean`, `rate_limit_hit(p_key text, p_max int, p_window_seconds int) returns boolean` (true = permitido).

- [ ] **Step 1: pgTAP que falha**: `subscribe_newsletter(' Ana@Teste.dev ', 'v1')` → `'ok'`, e de novo com `'ana@teste.dev'` → `'already'`; e-mail inválido → `throws_ok`; `anon` não lê `newsletter_subscriptions`; `request_stock_alert` como anon grava com `user_id null` e, como autenticado, com `auth.uid()`; repetir não duplica; produto inexistente → `throws_ok`; `toggle_favorite` alterna e devolve o novo estado; B não lê os favoritos de A; `saved_carts` rejeita `data` com 51 linhas; `rate_limit_hit('k', 2, 60)` → true, true, false; `anon` e `authenticated` não conseguem executar `rate_limit_hit`. Em `090`: `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity` = 0.
- [ ] **Step 2:** `npm run db:reset && npm run db:test` → FAIL.
- [ ] **Step 3: Migration** — conforme a spec §4. E-mails normalizados com `lower(trim(...))` e validados por regex simples (`^[^@\s]+@[^@\s]+\.[^@\s]+$`) e tamanho ≤ 254. `rate_limit_hit` com janela fixa (`window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)`) e `insert ... on conflict do update set count = count + 1 returning count <= p_max`. `revoke execute ... from public, anon, authenticated; grant ... to service_role`.
- [ ] **Step 4:** `npm run db:reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat(db): favorites, stock alerts, newsletter, saved carts and rate limits`

---

### Task 5: Clientes Supabase, tipos e IP do cliente

**Files:**

- Create: `lib/supabase/server.ts`, `lib/supabase/public.ts`, `lib/supabase/admin.ts`, `lib/supabase/auth-client.ts`, `lib/supabase/proxy.ts`, `lib/supabase/remember.ts`, `lib/supabase/database.types.ts` (gerado), `lib/client-ip.ts`
- Test: `tests/unit/supabase-remember.test.ts`, `tests/unit/client-ip.test.ts`

**Interfaces:**

- Produces:
  - `REMEMBER_COOKIE = "pp_remember"`, `REMEMBER_MAX_AGE = 2_592_000`, `applyRememberPolicy(options: CookieOptions, remember: boolean): CookieOptions` (com `remember`: `maxAge = REMEMBER_MAX_AGE`; sem: remove `maxAge` e `expires`).
  - `createSupabaseServerClient(): Promise<SupabaseClient<Database>>` — publishable key + cookies de `next/headers`, com `applyRememberPolicy` conforme a presença de `pp_remember`; `setAll` envolto em try/catch (em Server Components, o proxy é quem grava os cookies).
  - `createSupabasePublicClient(): SupabaseClient<Database>` — publishable key, sem cookies e sem sessão (`persistSession: false`). É o único cliente permitido dentro de `'use cache'`.
  - `createSupabaseAdminClient(): SupabaseClient<Database>` — secret key, `server-only`.
  - `createSupabaseAuthClient(clientIp: string | null): Promise<SupabaseClient<Database>>` — secret key + cookies (mesma política de remember) + cabeçalho `sb-forwarded-for` quando há IP. É usado só para as chamadas de `supabase.auth.*` que têm rate limit (signIn, signUp, resend, resetPasswordForEmail).
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null }>` — padrão oficial (`getClaims()` logo depois de criar o cliente), copiando cookies e os cabeçalhos `cache-control`/`expires`/`pragma`.
  - `getClientIp(): Promise<string | null>` e a função pura `parseClientIp(headerValue: string | null): string | null` (primeiro item da lista, sem espaços, até 45 caracteres).

- [ ] **Step 1: Testes que falham** — `applyRememberPolicy({ maxAge: 400 * 86400, path: "/" }, false)` → sem `maxAge` nem `expires`, com `path` mantido; `(…, true)` → `maxAge === 2_592_000`. `parseClientIp("203.0.113.9, 10.0.0.1")` → `"203.0.113.9"`; `parseClientIp(null)` e `parseClientIp("")` → `null`; uma string de 100 caracteres → `null`.
- [ ] **Step 2:** `npm test -- tests/unit/supabase-remember.test.ts tests/unit/client-ip.test.ts` → FAIL.
- [ ] **Step 3: Implementar os módulos acima.** `npm run db:types` gera `database.types.ts`, que fica versionado. Acrescentar o arquivo ao `.prettierignore` e aos ignores do ESLint.
- [ ] **Step 4:** testes → PASS; `npm run typecheck` → sem erros.
- [ ] **Step 5: Commit** `feat(data): supabase clients, remember policy and client ip`

---

### Task 6: Testes de contrato e adaptador de catálogo

**Files:**

- Create: `tests/contract/catalog.contract.ts`, `tests/unit/contract-mock.test.ts`, `tests/integration/contract-supabase.test.ts`, `tests/integration/support.ts`, `lib/data/supabase/catalog.ts`, `lib/data/supabase/map-product.ts`, `lib/data/supabase/errors.ts`
- Test: os três arquivos de teste acima

**Interfaces:**

- Consumes: `search_products` (Task 2), `createSupabasePublicClient` (Task 5).
- Produces:
  - `type ContractEnv<P> = { name: string; make: () => P; reset: () => Promise<void> }` e `describeCatalogContract(env: ContractEnv<CatalogPort>, ids: FixtureIds)`. O padrão vale para todos os contratos: `describeXContract`.
  - `FixtureIds` (em `tests/contract/fixture-ids.ts`): mapeia o slug das fixtures para o id usado por cada adaptador (string das fixtures no mock, UUID v5 no Supabase).
  - `createSupabaseCatalog(deps: { getClient: () => SupabaseClient<Database> }): CatalogPort`.
  - `CATALOG_TAG = "catalog"`, `productTag(slug: string): string` (`"product:" + slug`), exportados de `lib/data/supabase/catalog.ts`.
  - `toPortError(e: unknown): never` em `errors.ts` (lança `Error` com mensagem neutra e `cause`, sem repassar a mensagem crua).
  - `tests/integration/support.ts`: `resetDb()` (trunca tabelas mutáveis e reaplica o seed de catálogo via `admin`), `serviceClient()`, `signedInClient(email, senha)`.

- [ ] **Step 1: Contrato que falha** — mover para `catalog.contract.ts` os cenários de `tests/unit/mock-catalog.test.ts`: paginação (12 por página, página fora do intervalo é limitada), filtros (categoria, cores, disponível), as quatro ordens, `bySlug` inexistente → `null`, `related` com a mesma categoria primeiro, `featured` por rank, `byIds` preservando a ordem pedida e ignorando ids desconhecidos. Acrescentar os casos do Review Focus: `q = "coração"` e `q = "CORACAO"` dão o mesmo resultado; `q = "100%"`, `"a_b"` e `"'; drop table products; --"` → `items: []` sem exceção. `contract-mock.test.ts` roda o contrato com o mock; `contract-supabase.test.ts` roda com `createSupabaseCatalog({ getClient: createSupabasePublicClient })` e `resetDb` em `beforeEach`.
- [ ] **Step 2:** `npm test -- tests/unit/contract-mock.test.ts` → PASS (o mock já se comporta assim; se algum caso falhar, o contrato está errado ou o mock tem um bug a corrigir); `npm run test:integration` → FAIL (o adaptador não existe).
- [ ] **Step 3: Implementar `createSupabaseCatalog`** — `list` chama a RPC; `bySlug`, `related`, `featured` e `byIds` usam o query builder. `map-product.ts` converte linha → `Product` (snake → camel, `cuteness: "MAX"` constante). Cada método é envolvido por uma função `'use cache'` com `cacheTag(CATALOG_TAG)` (mais `cacheTag(productTag(slug))` em `bySlug`) e `cacheLife("hours")`. Remover `tests/unit/mock-catalog.test.ts` (coberto pelo contrato).
- [ ] **Step 4:** `npm test` e `npm run test:integration` → PASS.
- [ ] **Step 5: Commit** `feat(data): catalog contract tests and supabase catalog adapter`

---

### Task 7: Novo `AuthPort`, sessão no adaptador e mock atualizado

**Files:**

- Modify: `lib/data/ports.ts`, `lib/data/mock/auth.ts`, `lib/data/mock/store.ts`, `lib/data/mock/fixtures.ts`, `lib/session.ts`, `proxy.ts`
- Create: `lib/data/mock/session-cookie.ts` (conteúdo de `lib/session-seal.ts`, movido), `app/api/__mock__/inbox/route.ts`, `tests/contract/auth.contract.ts`
- Delete: `lib/session-seal.ts`
- Test: `tests/unit/contract-mock.test.ts` (acrescenta o contrato de auth), `tests/unit/session.test.ts`, `tests/unit/mock-auth.test.ts` (fica só o que for específico do mock)

**Interfaces:**

- Produces (em `lib/data/ports.ts`):

```ts
export type SignUpResult = { status: "confirmacao_pendente"; userId: string | null };
export type SignInResult = AuthUser | null | { error: "email_nao_confirmado" };
export type EmailLinkType = "email" | "recovery";

export interface AuthPort {
  signIn(email: string, password: string, remember: boolean): Promise<SignInResult>;
  /** userId null = the e-mail already had an account (nothing else changes for the caller). */
  signUp(i: SignUpInput, next: string): Promise<SignUpResult>;
  signInWithProvider(p: AuthProvider, next: string): Promise<{ url: string }>;
  /** true = session created. */
  completeOAuth(code: string): Promise<boolean>;
  /** true = link valid; for "email" signs the user in, for "recovery" opens a recovery session. */
  verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<boolean>;
  resendConfirmation(email: string, next: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Needs the recovery (or a normal) session; signs every other session out. */
  updatePassword(next: string): Promise<{ ok: boolean }>;
  signOut(): Promise<void>;
  currentUser(): Promise<AuthUser | null>;
  savedCart(userId: string): Promise<CartData | null>;
  saveCart(userId: string, cart: CartData): Promise<void>;
}
```

- Também em `ports.ts`: `RateLimitPort { hit(key: string, max: number, windowSeconds: number): Promise<boolean> }` e `rateLimit: RateLimitPort` em `Ports` (o adaptador mock é em memória e entra nesta task, junto com um `reset()` no store).
- Mock: `MockStore.pendingUsers` (usuários criados e ainda não confirmados), `MockStore.inbox: { to: string; kind: "confirmacao" | "recuperacao"; link: string }[]`. O link do mock é `/auth/confirm?token_hash=<uuid>&type=email|recovery&next=<next>`. `GET /api/__mock__/inbox?email=` devolve a lista do e-mail, ou 404 fora do mock.
- `signInWithProvider` no mock devolve `{ url: "/auth/callback?code=mock-<provider>&next=<next>" }`; `completeOAuth("mock-google")` faz login como "ana".
- `getSession()` continua com a mesma assinatura e passa a ser `cache(async () => { await connection(); return getData().auth.currentUser(); })`. `createSession`/`destroySession` saem.
- `proxy.ts`: em `supabase`, `updateSession(request)` e redirecionamento para `/entrar?next=` em `/conta/:path*` sem `userId`; em `mock`, a checagem atual do selo (via `session-cookie.ts`). O matcher passa a cobrir todas as rotas, exceto estáticos (padrão do `@supabase/ssr`), porque o refresh precisa rodar em qualquer navegação; a regra de redirecionamento continua valendo só para `/conta`.

- [ ] **Step 1: Contrato de auth que falha (`auth.contract.ts`)**: `signUp` de e-mail novo → `{ status: "confirmacao_pendente", userId: <string> }`; `signIn` antes de confirmar, com a senha certa → `{ error: "email_nao_confirmado" }`, e com a senha errada → `null`; `signUp` de e-mail existente (`" ANA@teste.dev "`) → `userId: null`; depois de `verifyEmailLink(tokenDoEmail, "email")` → `currentUser()` devolve o usuário; o mesmo token outra vez → `false`; `token_hash` inventado → `false`; `signOut()` → `currentUser()` null; `requestPasswordReset` de e-mail inexistente resolve sem erro e não gera e-mail; a recuperação (`verifyEmailLink(t, "recovery")` + `updatePassword("Nova@1234")`) faz a senha antiga falhar e a nova funcionar. O contrato recebe uma função `readInbox(email)` (no mock, lê `store.inbox`; no Supabase, a API do Mailpit) e uma função `withSession(fn)` para isolar os cookies entre os casos.
- [ ] **Step 2:** `npm test -- tests/unit/contract-mock.test.ts` → FAIL.
- [ ] **Step 3: Implementar** o mock (`session-cookie.ts` grava e lê o selo via `cookies()`; `remember` mantém o comportamento atual) e o novo `getSession`/`proxy`. Ajustar `tests/unit/session.test.ts` para o novo `getSession`.
- [ ] **Step 4:** `npm test` → o contrato e o teste de sessão passam. Os testes de actions quebram e são corrigidos na Task 8; marcar essas falhas como esperadas no relatório desta task, sem `skip`.
- [ ] **Step 5: Commit** `feat(auth): email-confirmation auth port with session owned by the adapter`

---

### Task 8: Actions e telas de auth no novo contrato

**Files:**

- Modify: `app/(conta)/actions.ts`, `app/(checkout)/checkout/actions.ts`, `components/conta/SignupForm.tsx`, `components/conta/LoginForm.tsx`, `components/conta/SocialButtons.tsx`, `components/conta/AuthPage.tsx`, `components/checkout/CheckoutForm.tsx`, `app/(checkout)/pedido/[id]/confirmado/page.tsx`, `lib/guest-orders.ts`
- Create: `app/(conta)/cadastro/confirme-seu-email/page.tsx`, `components/conta/ConfirmEmailNotice.tsx`, `lib/rate-limit.ts`
- Test: `tests/unit/auth-actions.test.ts`, `tests/unit/checkout-actions.test.ts`, `tests/unit/newsletter-action.test.ts`, `tests/unit/loja-actions.test.ts`, `tests/unit/rate-limit.test.ts`, `tests/e2e/auth.spec.ts`, `tests/e2e/checkout.spec.ts`

**Interfaces:**

- Consumes: `AuthPort`, `RateLimitPort` (Task 7), `getClientIp` (Task 5).
- Produces:
  - `type RateLimitAction = "login" | "cadastro" | "reenvio" | "recuperacao" | "newsletter" | "aviso_estoque"`; `RATE_LIMITS = { perEmail: { max: 5, windowSeconds: 900 }, perIp: { max: 20, windowSeconds: 900 } }`; `allowAttempt(action: RateLimitAction, email: string | null): Promise<boolean>` (consome as duas chaves, `ip:<ação>:<ip>` e `email:<ação>:<email normalizado>`; sem IP, só a de e-mail). Mensagem única: `RATE_LIMITED = "Muitas tentativas. Tente de novo em alguns minutos."`
  - `signupAction` → `{ status: "ok", redirectTo: "/cadastro/confirme-seu-email?email=<e-mail>" }`, sem criar sessão. O e-mail vai na URL só para exibir e reenviar, e a página o mascara (`a***@teste.dev`).
  - `loginAction` → em `email_nao_confirmado`, `{ status: "error", message: "Confirme seu e-mail para entrar.", unconfirmed: true }`; o `LoginForm` mostra então o botão "REENVIAR LINK".
  - `resendConfirmationAction(email: unknown, next: unknown): Promise<FormState>` → sempre `"Se houver uma conta pendente, enviamos um novo link."` (ou `RATE_LIMITED`).
  - `socialAction` → `{ status: "ok", redirectTo: url }`; o cliente faz `window.location.assign(url)` quando a URL é externa.
  - `logoutAction` → `auth.signOut()` + `clearGuestTokens()` (nova função em `lib/guest-orders.ts`).
  - Checkout: sem sessão e com `saveAccount`, chama `signUp` e cria o pedido **sempre** com `guestToken`, mais `userId: created.userId` (null se o e-mail já existia). O resultado troca `accountCreated` por `accountPending: boolean`; a confirmação do pedido mostra "Enviamos um link para ativar sua conta." quando recebe `?conta=pendente`.
  - Rate limit aplicado em `loginAction`, `signupAction`, `resendConfirmationAction`, `recoverAction`, `subscribeNewsletter` e `stockAlertAction`, antes de chamar o port.

- [ ] **Step 1: Testes que falham** — em `auth-actions.test.ts`: o cadastro não chama `createSession` e devolve o `redirectTo` da tela de confirmação; o login de usuário não confirmado devolve `unconfirmed: true`; a 6ª tentativa de login com o mesmo e-mail em 15 min → `RATE_LIMITED`, sem chamar `signIn`; o logout limpa `pp_guest_orders`. Em `checkout-actions.test.ts`: "salvar meus dados" com e-mail novo → pedido com `userId` e `guestToken`, e `accountPending: true`; com e-mail existente → pedido sem `userId` e com a mesma resposta para o cliente. Em `rate-limit.test.ts`: as duas chaves são consumidas; sem IP, só a de e-mail. Nos E2E `auth.spec.ts`: cadastro → tela "CONFIRA SEU E-MAIL" → o link de `/api/__mock__/inbox` → chega em `/conta` logado.
- [ ] **Step 2:** `npm test` → FAIL nos novos casos.
- [ ] **Step 3: Implementar** as actions, a tela "Confira seu e-mail" (título pixel "CONFIRA SEU E-MAIL", texto "Enviamos um link para <e-mail mascarado>. Abra para ativar sua conta.", botão "REENVIAR LINK", link "‹ VOLTAR PARA ENTRAR") e os ajustes de formulário. Atualizar as fixtures e os helpers de E2E que faziam login logo depois do cadastro.
- [ ] **Step 4:** `npm run check` → PASS; `npm run e2e` → PASS (a suíte inteira, no mock); `npm run e2e:visual`, com os baselines novos revisados lado a lado com `/entrar`.
- [ ] **Step 5: Commit** `feat(auth): confirmation-pending sign-up, resend, rate limits and guest-cookie cleanup`

---

### Task 9: Adaptador Supabase de auth

**Files:**

- Create: `lib/data/supabase/auth.ts`, `tests/integration/mailpit.ts`
- Modify: `tests/integration/contract-supabase.test.ts`
- Test: o contrato de auth (Task 7) contra o Supabase

**Interfaces:**

- Consumes: `createSupabaseServerClient`, `createSupabaseAuthClient`, `getClientIp` (Task 5); `handle_new_user` (Task 3); `saved_carts` (Task 4).
- Produces: `createSupabaseAuth(deps: { getClient: () => Promise<SupabaseClient<Database>>; getAuthClient: () => Promise<SupabaseClient<Database>>; siteUrl: string }): AuthPort`. `tests/integration/mailpit.ts`: `latestLink(email: string): Promise<string>` (lê `http://127.0.0.1:54324/api/v1/messages`, pega a mensagem mais recente para o e-mail e extrai o `href` de `/auth/confirm`; confirmar a porta com `npx supabase status`).
- Mapeamento:
  - `signUp`: `auth.signUp({ email, password, options: { emailRedirectTo: siteUrl + "/auth/confirm?next=" + encodeURIComponent(next), data: { name, phone, cpf, terms_version, marketing_email, marketing_version, address } } })`. `userId = data.user?.identities?.length ? data.user.id : null`.
  - `signIn`: grava o cookie `pp_remember` antes (quando `remember`); o erro com `code === "email_not_confirmed"` vira `{ error: "email_nao_confirmado" }`; `invalid_credentials` vira `null`; qualquer outro erro passa por `toPortError`.
  - `verifyEmailLink`: `auth.verifyOtp({ token_hash, type })`; erro → `false`.
  - `completeOAuth`: `exchangeCodeForSession(code)`; erro → `false`.
  - `signInWithProvider`: `signInWithOAuth({ provider, options: { redirectTo: siteUrl + "/auth/callback?next=" + encodeURIComponent(next), skipBrowserRedirect: true } })` → `{ url: data.url }`.
  - `updatePassword`: `updateUser({ password })` e depois `signOut({ scope: "others" })`.
  - `signOut`: `signOut()` + apaga `pp_remember`.
  - `currentUser`: `getUser()` + `profiles.name`; sem perfil → `null`.
  - `resendConfirmation`: `auth.resend({ type: "signup", email, options: { emailRedirectTo } })`, ignorando o erro de "usuário não encontrado".
  - `requestPasswordReset`: `resetPasswordForEmail(email, { redirectTo: siteUrl + "/auth/confirm?next=/redefinir-senha" })`.
- `supabase/config.toml` (nesta task): `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/**", "http://localhost:3200/**"]`, `[auth.email] enable_confirmations = true`, `[auth.rate_limit]` com valores altos (rede de segurança), Google/Facebook com `enabled = false` localmente e `client_id`/`secret` vindos de `env(...)`.

- [ ] **Step 1:** ligar o contrato de auth em `contract-supabase.test.ts`, com `readInbox = latestLink` e `withSession` usando um armazenamento de cookies em memória injetado em `getClient`/`getAuthClient`. Acrescentar o caso do Review Focus: depois de logar, forçar a expiração do access token (`auth.admin` não expira tokens, então criar a sessão, ajustar o relógio do cliente com `vi.setSystemTime` para depois de `expires_at` e chamar `currentUser()`) → o usuário continua sendo devolvido, porque o refresh token renovou a sessão.
- [ ] **Step 2:** `npm run test:integration` → FAIL.
- [ ] **Step 3: Implementar** `createSupabaseAuth` e o `config.toml`.
- [ ] **Step 4:** `npm run db:reset && npm run test:integration` → PASS.
- [ ] **Step 5: Commit** `feat(auth): supabase auth adapter with email confirmation`

---

### Task 10: Adaptadores de engajamento, newsletter, CEP, rate limit e ponte de conta

**Files:**

- Create: `lib/data/supabase/engagement.ts`, `lib/data/supabase/newsletter.ts`, `lib/data/supabase/rate-limit.ts`, `lib/data/supabase/account-reads.ts`, `lib/data/viacep.ts`, `tests/contract/engagement.contract.ts`, `tests/contract/newsletter.contract.ts`, `tests/unit/viacep.test.ts`
- Modify: `lib/data/index.ts`, `tests/unit/contract-mock.test.ts`, `tests/integration/contract-supabase.test.ts`
- Test: os contratos nos dois adaptadores; `viacep.test.ts` com `fetch` simulado

**Interfaces:**

- Produces:
  - `createSupabaseEngagement(deps: { getClient })`, `createSupabaseNewsletter(deps: { getClient })`, `createSupabaseRateLimit(deps: { getAdmin: () => SupabaseClient<Database> })`.
  - `createSupabaseAccountReads(deps: { getClient }): AccountPort`: `profile`, `addresses`, `consents` e `connections` (estas a partir de `getUser().identities`) implementados; os demais métodos lançam `NotAvailableYetError` (classe exportada, `message = "Disponível no sub-projeto 3"`).
  - `createViaCepLookup(deps?: { fetch?: typeof fetch; timeoutMs?: number }): AddressLookupPort` — `https://viacep.com.br/ws/<8 dígitos>/json/`, timeout padrão de 3000 ms via `AbortSignal.timeout`; `{ erro: true }`, status ≠ 200, timeout ou exceção → `null`. É usado só no modo `supabase`: o mock continua com o CEP fixo, para o E2E ser determinístico.
  - `getData()`: em `supabase`, `catalog`, `auth`, `engagement`, `newsletter`, `rateLimit`, `addressLookup` e `account` (ponte) reais; `shipping`, `coupons`, `orders`, `payments` e `returns` do mock. O objeto continua memoizado, mas as fábricas de cliente são chamadas **por requisição** (dentro dos métodos), nunca no momento de montar os ports.

- [ ] **Step 1: Contratos que falham** — engajamento: `toggleFavorite` alterna; `favorites` só do dono; `requestStockAlert` com `" Ana@Teste.dev "` não duplica com `"ana@teste.dev"`. Newsletter: primeiro `ok`, depois `already` com outra caixa ou espaços. ViaCEP: `01001000` → endereço mapeado; `{ erro: true }` → `null`; o `fetch` que nunca responde → `null` em ~3 s (usar `timeoutMs: 50` no teste); `"123"` → `null` sem chamar `fetch`.
- [ ] **Step 2:** `npm test` e `npm run test:integration` → FAIL.
- [ ] **Step 3: Implementar** os adaptadores e a tabela de `getData()`. Os adaptadores conferem `userId === (await getClient().auth.getUser()).data.user?.id` e lançam `Error("session mismatch")` se forem diferentes.
- [ ] **Step 4:** `npm test` e `npm run test:integration` → PASS.
- [ ] **Step 5: Commit** `feat(data): supabase engagement, newsletter, rate limit, account reads and viacep`

---

### Task 11: Rotas de confirmação e callback, `/redefinir-senha`, revalidação e templates de e-mail

**Files:**

- Create: `app/auth/confirm/route.ts`, `app/auth/callback/route.ts`, `app/(conta)/redefinir-senha/page.tsx`, `app/(conta)/redefinir-senha/actions.ts`, `components/conta/ResetPasswordForm.tsx`, `app/api/revalidate/route.ts`, `supabase/migrations/<ts>_revalidate_trigger.sql`, `supabase/templates/confirmacao.html`, `supabase/templates/recuperacao.html`, `lib/validation/reset-password.ts`
- Modify: `components/conta/AuthPage.tsx` (lê `?erro=link`), `supabase/config.toml` (templates e SMTP)
- Test: `tests/unit/auth-routes.test.ts`, `tests/unit/revalidate-route.test.ts`, `tests/unit/reset-password-action.test.ts`, `supabase/tests/040-revalidate.test.sql`, `tests/e2e/redefinir-senha.spec.ts`, `tests/e2e/redefinir-senha.mobile.spec.ts`

**Interfaces:**

- Consumes: `AuthPort.verifyEmailLink`, `completeOAuth`, `updatePassword` (Task 7); `safeNext`; `CATALOG_TAG`, `productTag` (Task 6).
- Produces:
  - `GET /auth/confirm?token_hash&type&next`: `type` fora de `email|recovery` ou link inválido → 303 para `/entrar?erro=link`; `recovery` válido → `/redefinir-senha`; `email` válido → `safeNext(next)`.
  - `GET /auth/callback?code&next`: o mesmo padrão com `completeOAuth`.
  - `/entrar?erro=link` mostra o alerta "Link inválido ou expirado. Peça um novo." (`role="alert"`).
  - `/redefinir-senha`: sem sessão → redireciona para `/recuperar-senha`. O formulário usa nova senha + confirmação com as mesmas regras de `PasswordRules`; em caso de sucesso, vai para `/conta` com o toast "Senha alterada."
  - `POST /api/revalidate`: `Authorization: Bearer <REVALIDATE_SECRET>` comparado com `timingSafeEqual`; corpo `{ slugs: string[] }` (até 100); executa `revalidateTag(CATALOG_TAG)` e `revalidateTag(productTag(s))` para cada slug; responde 401 sem o segredo e 400 com corpo inválido.
  - Migration: trigger `after insert or update or delete on products for each statement`, usando tabela de transição para juntar os slugs, que chama `net.http_post` quando existem `vault.decrypted_secrets` com `name in ('site_url','revalidate_secret')`; se não existirem, não faz nada.
  - Templates: link `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` (confirmação) e `...&type=recovery` (recuperação). O texto segue o tom da marca, e o remetente fica `[PLACEHOLDER]` em `config.toml` (`[auth.email.smtp]` com `host`/`user`/`pass` vindos de `env(RESEND_SMTP_*)`, `enabled = false` localmente, porque o Mailpit cobre o ambiente local).

- [ ] **Step 1: Testes que falham** — rotas: `token_hash` inválido → 303 `/entrar?erro=link`; `type=signup` (não aceito) → idem; `next=//evil.com`, `https://evil.com` e `%2F%2Fevil.com` → `/conta`; `recovery` → `/redefinir-senha`. Revalidação: sem cabeçalho → 401; segredo errado → 401; `{ slugs: "x" }` → 400; certo → 200 com `revalidateTag` chamado para `catalog` e `product:chaveiro-x`. pgTAP: sem segredos no Vault, um UPDATE em `products` não chama `net.http_post` (conferir `net.http_request_queue` vazia); com segredos, há 1 requisição na fila contendo o slug. E2E: recuperação no mock (pedir → inbox → `/redefinir-senha` → nova senha → `/conta`) e o snapshot visual nos dois tamanhos.
- [ ] **Step 2:** `npm test` e `npm run db:test` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm run check`, `npm run db:test`, `npm run e2e` → PASS; `npm run e2e:visual`, com os baselines novos revisados.
- [ ] **Step 5: Commit** `feat(auth): confirm and callback routes, password reset page, catalog revalidation`

---

### Task 12: E2E em modo Supabase

**Files:**

- Create: `playwright.supabase.config.ts`, `tests/e2e-supabase/auth.spec.ts`, `tests/e2e-supabase/catalogo.spec.ts`, `tests/e2e-supabase/support/mailpit.ts`
- Modify: `package.json` (`"e2e:supabase": "playwright test -c playwright.supabase.config.ts"`)

**Interfaces:**

- Consumes: tudo o que veio antes; `latestLink` (mesma lógica de `tests/integration/mailpit.ts`, que pode ser reaproveitada).
- `playwright.supabase.config.ts`: porta 3200, `DATA_SOURCE=supabase`, variáveis do Supabase local, `CLIENT_IP_HEADER=x-forwarded-for`, `REVALIDATE_SECRET` de teste, só o projeto `desktop`, `workers: 1`. No `globalSetup`, roda `supabase db reset` (exige `supabase start` antes).

- [ ] **Step 1: Specs** — `auth.spec.ts`: cadastro → "CONFIRA SEU E-MAIL" → link do Mailpit → `/conta` com o nome; sair → `/entrar` → login com "manter conectado" desmarcado → os cookies `sb-*` sem `expires`; com a opção marcada → `expires` ~30 dias; recuperação de senha de ponta a ponta; link usado duas vezes → alerta de link inválido; login de conta não confirmada → "REENVIAR LINK". `catalogo.spec.ts`: `/loja` lista os 9 produtos do seed com `[PREÇO]`; `/produto/<slug>` abre; o favorito persiste após recarregar; newsletter → mensagem neutra.
- [ ] **Step 2:** `npm run db:start && npm run e2e:supabase` → FAIL antes dos ajustes e PASS depois de corrigir o que aparecer (os bugs encontrados aqui são corrigidos na task dona do código, com teste).
- [ ] **Step 3: Commit** `test(e2e): supabase-mode auth and catalog suite`

---

### Task 13: CI, deploy das migrations e documentação

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy-db.yml`
- Modify: `README.md`, `docs/PENDENCIAS.md`, `CLAUDE.md` (seção de dados)

**Interfaces:**

- `ci.yml` (em `push` e `pull_request`), dois jobs:
  - `check`: Node 24, `npm ci`, `npm run check`.
  - `supabase`: `supabase/setup-cli@v1` (versão igual à do devDependency), `supabase start`, `supabase test db`, `npm run db:types && git diff --exit-code lib/supabase/database.types.ts`, `npm run test:integration`, `npx playwright install --with-deps chromium`, `npm run e2e:supabase`.
- `deploy-db.yml`: `workflow_dispatch` + `push` na `main` com `paths: ["supabase/**"]`; `supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}` e `supabase db push`, com os secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` e `SUPABASE_PROJECT_REF`. Se `SUPABASE_PROJECT_REF` não existir, o job termina com um aviso, sem falhar (o projeto na nuvem ainda não foi criado).
- `PENDENCIAS.md`: marcar como resolvidos os itens do §3 cobertos (seals sem revogação, `pp_guest_orders` no logout, limite de tentativas, cadastro que revela e-mail, cache das páginas de produto); no §1, acrescentar "Domínio remetente (Resend)" e "Credenciais OAuth Google/Facebook"; no §2, registrar as telas novas (confirmação e redefinição) como desvio do design; no §5, marcar os ports entregues. Novo item para o dono: ligar o "IP Address Forwarding" do Supabase Auth (painel em Authentication → Rate Limits, ou `security_sb_forwarded_for_enabled` pela Management API) depois de criar o projeto.
- `README.md`: como subir (`wsl --shutdown` se precisar, `npm run db:start`, copiar as variáveis de `npx supabase status -o env` para `.env.local`, `DATA_SOURCE=supabase`, `npm run dev`), como criar migration (`npx supabase migration new <nome>`), testes (`db:test`, `test:integration`, `e2e:supabase`) e como fazer o deploy.

- [ ] **Step 1:** escrever os workflows e validar a sintaxe com `npx --yes @action-validator/cli .github/workflows/*.yml` (ou `actionlint`, se estiver instalado).
- [ ] **Step 2:** atualizar a documentação.
- [ ] **Step 3:** `npm run check` → PASS; push da branch e o run do CI verde (`gh run watch`).
- [ ] **Step 4: Commit** `ci: supabase checks and migrations deploy workflow` + `docs: backend 1/4 setup and resolved pendencias`
