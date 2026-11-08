# Backend 1/4 — Fundação Supabase, Catálogo e Auth — Design

Data: 2026-11-07 · Status: aprovado em conversa, aguardando revisão da spec escrita

## 1. Objetivo

Trocar o adaptador mock pelo Supabase nos ports de catálogo, auth, busca de CEP, newsletter e engajamento, sem mudar as telas existentes. Com `DATA_SOURCE=supabase`, a loja passa a ler produtos reais e a ter contas reais (com confirmação de e-mail), e os demais ports continuam mock até os sub-projetos seguintes.

Critério de sucesso: com `DATA_SOURCE=supabase` e o Supabase local rodando, uma pessoa navega pelo catálogo, cria conta, confirma o e-mail, entra, sai, recupera a senha, favorita, pede aviso de estoque e assina a newsletter. Todas as políticas RLS passam nos testes pgTAP e os testes de contrato passam nos dois adaptadores. A suíte E2E atual (mock) continua verde.

## 2. Contexto e decisões tomadas

| Decisão               | Escolha                                                                                | Motivo                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forma do backend      | Supabase como código (migrations, RLS, funções), sem API própria                       | O Next fala direto com o Supabase. É o que o `CLAUDE.md` prevê e dá menos código para manter                                                         |
| Repositório           | Pasta `supabase/` **neste** repositório (renomeado para `hana-beads-store`)            | Migration, política, adaptador e teste mudam juntos. Os tipos são gerados localmente. O repositório separado `hana-beads-store-backend` fica sem uso |
| Hospedagem do banco   | Supabase Cloud (Free no desenvolvimento, Pro perto do lançamento) + Supabase CLI local | Backup e manutenção gerenciados                                                                                                                      |
| Hospedagem do Next    | Indefinida                                                                             | O design não depende dela (webhook e rate limit funcionam em qualquer host)                                                                          |
| Sessão                | `@supabase/ssr` no lugar do `iron-session`                                             | O RLS vale com o JWT do usuário, e o refresh token é revogável (resolve a pendência dos seals sem revogação)                                         |
| Confirmação de e-mail | Obrigatória no cadastro                                                                | Escolha do dono. Como efeito, o cadastro deixa de revelar se o e-mail já tem conta                                                                   |
| Operação da loja      | Painel `/admin` no Next (sub-projeto 4)                                                | Este sub-projeto já cria o papel admin e as políticas correspondentes                                                                                |

Divisão do backend (cada sub-projeto tem sua própria spec, plano e execução):

1. **Fundação + Catálogo + Auth** (este documento)
2. Compra: pedidos, cupons, frete (Melhor Envio), pagamento (Mercado Pago) + webhook, expiração de pedidos, e-mails transacionais
3. Pós-venda + LGPD: trocas, `AccountPort` completo, exportação e exclusão, consentimento de marketing unificado
4. Painel `/admin`

## 3. Estrutura e fluxo de dados

```
supabase/
  config.toml        # auth: confirmação de e-mail ligada, SMTP (Resend), Google/Facebook, Apple desligado
  migrations/        # SQL versionado: schema, RLS, funções, triggers
  seed.sql           # produtos das fixtures atuais (preço null) + usuário admin de desenvolvimento
  templates/         # e-mails de auth em pt-BR: confirmação de cadastro, redefinição de senha
  tests/             # pgTAP
lib/supabase/
  server.ts          # cliente com cookies para Server Components e Server Actions
  client.ts          # cliente do navegador (só onde for preciso)
  proxy.ts           # refresh da sessão no proxy do Next
  admin.ts           # cliente service_role, `server-only`, único lugar que o importa
  database.types.ts  # gerado por `npm run db:types`
lib/data/supabase/   # um adaptador por port + errors.ts
```

- **Seleção de adaptador.** `DATA_SOURCE` aceita `mock | supabase`. Em `supabase`, `getData()` monta `catalog`, `auth`, `addressLookup`, `newsletter` e `engagement` com os adaptadores reais e os outros ports com o mock. É uma tabela explícita em `lib/data/index.ts`, atualizada a cada sub-projeto.
- **Quem acessa o banco.** Server Components e Server Actions usam `lib/supabase/server.ts` (JWT do usuário, com RLS). Os adaptadores recebem `userId` como hoje e conferem que ele é igual ao `sub` do JWT; se for diferente, lançam exceção. `lib/supabase/admin.ts` (service_role) só é usado para `rate_limit_hit` e para operações de sistema sem usuário.
- **Sessão.** `getSession()` mantém a assinatura (`SessionUser | null`) e passa a usar `supabase.auth.getUser()` + `profiles`. Saem `iron-session`, `lib/session-seal.ts`, o cookie `pp_session` e a variável `SESSION_SECRET`. O proxy usa o padrão de refresh do `@supabase/ssr`.
- **Tipos.** `npm run db:types` roda `supabase gen types typescript --local > lib/supabase/database.types.ts`. O arquivo fica versionado.
- **Variáveis novas** (em `lib/env.ts` e `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou a publishable key equivalente na versão atual do Supabase), `SUPABASE_SERVICE_ROLE_KEY` (servidor), `REVALIDATE_SECRET`.

## 4. Modelo de dados

RLS ligado em todas as tabelas de `public`. Um teste pgTAP falha se alguma tabela estiver sem RLS.

| Tabela                     | Colunas principais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Acesso                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `products`                 | `id uuid`, `slug` único, `name`, `description`, `price_cents int null`, `rarity` (check `comum/raro/epico` ou null), `is_new`, `stock int check >= 0`, `categories text[]` e `colors text[]` (check: subconjunto das listas `CATEGORY_IDS`/`COLOR_IDS`), `category_label`, `images jsonb`, `art jsonb null`, `illustrative`, `size_cm numeric null`, `bead_count int null`, `options jsonb` (argola + `price_delta_cents`), `featured_rank int null` único, `published bool`, `created_at`, `updated_at`, `search tsvector` gerado (com `unaccent`, sobre nome, descrição e rótulo) | SELECT: todos, onde `published`. Escrita: só `is_admin()`                                                       |
| `profiles`                 | `id` = `auth.users.id` (FK com cascade), `name`, `phone`, `cpf null`, `avatar_url null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | SELECT/UPDATE: o dono e admin. Criado pelo trigger `on auth.users insert`, com os dados de `raw_user_meta_data` |
| `admins`                   | `user_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | SELECT: admin. Sem escrita pelo app (inserção manual ou via seed)                                               |
| `addresses`                | campos do tipo `Address` + `user_id`, `is_default`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | só o dono. O signUp do checkout grava o primeiro endereço. O CRUD completo fica para o sub-projeto 3            |
| `consents`                 | `user_id`, `type` (`terms/privacy/email_marketing`), `granted`, `version`, `granted_at`, `revoked_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | o dono lê e insere. Sem UPDATE/DELETE para nenhum papel (append-only). O signUp grava os aceites                |
| `favorites`                | `user_id`, `product_id`, PK composta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | só o dono                                                                                                       |
| `stock_alerts`             | `id`, `user_id null`, `email`, `product_id`, `consented_at`, `notified_at null`, único por (`email`, `product_id`) enquanto não notificado                                                                                                                                                                                                                                                                                                                                                                                                                                          | o dono lê os seus. Inserção só pela RPC                                                                         |
| `newsletter_subscriptions` | `email` único (normalizado em minúsculas), `consent_version`, `consented_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | sem acesso direto. Escrita só pela RPC                                                                          |
| `saved_carts`              | `user_id` PK, `data jsonb` (check: até 50 linhas), `updated_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | só o dono                                                                                                       |
| `rate_limits`              | `key`, `window_start`, `count`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | só a `service_role`                                                                                             |

Funções:

- `is_admin()` — `security definer`, `stable`, consulta `admins` com `auth.uid()`.
- `subscribe_newsletter(email, consent_version)` — `security definer`, executável por `anon` e `authenticated`. Valida o e-mail e devolve `'ok' | 'already'`.
- `request_stock_alert(email, product_id, consented_at)` — `security definer`. Usa `auth.uid()` quando existe, valida o produto e remove duplicatas.
- `rate_limit_hit(key, max, window_seconds) returns boolean` — executável só pela `service_role`, com janela fixa.
- Busca e listagem do catálogo — `search_products(...)` em SQL, devolvendo os itens da página e o total, com a mesma semântica de filtros e ordenação de `filterProducts` em `lib/shop-query.ts`. Os testes de contrato garantem que mock e Supabase devolvem a mesma ordem.

**Revalidação do cache.** O trigger `after update or insert or delete` em `products` (para as colunas que aparecem nas telas) usa `pg_net` para chamar `POST {SITE_URL}/api/revalidate`, com o cabeçalho `Authorization: Bearer {REVALIDATE_SECRET}`. `SITE_URL` e o segredo ficam no Vault do Supabase. A rota executa `revalidateTag('catalog')` e `revalidateTag('product:<slug>')`, e os adaptadores do catálogo marcam suas leituras com essas tags. Se o site não estiver configurado no Vault, o trigger não faz nada (ambiente local sem o Next rodando).

**Seed.** Os 9 produtos das fixtures atuais, com `price_cents null`, e um usuário admin de desenvolvimento (só no seed local, nunca em produção).

## 5. Fluxos de auth

Mudanças no `AuthPort`. O adaptador mock é atualizado com o mesmo comportamento:

| Método                        | Novo contrato                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signUp(i)`                   | `{ status: "confirmacao_pendente"; userId: string }` sempre (não existe mais `email_em_uso`). Como ainda não há sessão (e-mail não confirmado), perfil, consentimentos e, vindo do checkout, CPF e endereço vão em `options.data` (metadados) e são gravados pelo trigger `security definer` de `auth.users`, que valida cada campo |
| `signIn(email, senha)`        | `AuthUser \| null \| { error: "email_nao_confirmado" }`                                                                                                                                                                                                                                                                             |
| `signInWithProvider(p, next)` | `{ url: string }` para redirecionar                                                                                                                                                                                                                                                                                                 |
| `resendConfirmation(email)`   | `void`, mesma resposta exista ou não a conta                                                                                                                                                                                                                                                                                        |
| `requestPasswordReset(email)` | sem mudança                                                                                                                                                                                                                                                                                                                         |
| `updatePassword(nova)`        | `{ ok: boolean }`, na sessão de recuperação; depois executa `signOut({ scope: "others" })`                                                                                                                                                                                                                                          |
| `signOut()`                   | revoga a sessão atual                                                                                                                                                                                                                                                                                                               |
| `currentUser()`               | substitui `userById`: lê o JWT e o perfil; null se não houver sessão ou se a conta não existir mais                                                                                                                                                                                                                                 |
| `savedCart` / `saveCart`      | sem mudança                                                                                                                                                                                                                                                                                                                         |

Fluxos:

- **Cadastro:** a action chama `signUp` e redireciona para a tela "Confira seu e-mail" (com botão de reenviar, sujeito ao limite de tentativas). O link do e-mail abre `/auth/confirm?token_hash=…&type=email&next=…` (nota: `type=email`, não `signup`, que o Supabase marca como obsoleto para `verifyOtp` com `token_hash`), que executa `verifyOtp`, cria a sessão e redireciona para `next` (padrão `/conta`; só caminhos internos são aceitos).
- **Checkout com "salvar meus dados":** a conta é criada pendente e o pedido segue como convidado (`guestToken` + cookie `pp_guest_orders`), já gravado com o `userId` novo. A tela de pedido confirmado mostra: "Enviamos um link para ativar sua conta." O aviso "E-mail já cadastrado" do checkout deixa de existir.
- **Login com e-mail não confirmado:** mostra a mensagem e um botão para reenviar a confirmação.
- **OAuth (Google, Facebook; Apple atrás de `NEXT_PUBLIC_AUTH_APPLE`):** a action obtém a URL e redireciona. `/auth/callback` executa `exchangeCodeForSession` e redireciona para `next`.
- **Recuperar senha:** o e-mail abre `/auth/confirm` com `type=recovery`, que leva a `/redefinir-senha` (tela nova). Lá, `updatePassword` derruba as outras sessões e leva a `/conta`.
- **Sair:** `signOut()` e exclusão do cookie `pp_guest_orders`.
- **"Manter conectado":** o cookie `pp_remember` guarda a escolha. Sem ele, os cookies do `@supabase/ssr` são gravados sem `maxAge` (sessão do navegador); com ele, `maxAge` de 30 dias.

Telas novas: "Confira seu e-mail" e `/redefinir-senha`. Não existem nos `.dc.html`: são montadas com os componentes de `/entrar` e `/recuperar-senha` e com a microcopy do glossário do briefing, e entram como desvio registrado em `docs/PENDENCIAS.md` §2.

E-mails de auth: templates em pt-BR em `supabase/templates/`, enviados pelo SMTP do Resend. O remetente é `[PLACEHOLDER]` até a dona fornecer o domínio.

## 6. Limite de tentativas

O Supabase Auth limita por IP, mas as chamadas saem do servidor do Next, então todos os clientes compartilham o mesmo IP. Por isso:

- As Server Actions de login, cadastro, reenvio de confirmação, recuperação de senha, newsletter e aviso de estoque chamam `rate_limit_hit` com duas chaves: `ip:<ação>:<ip>` e `email:<ação>:<email normalizado>`. Os valores iniciais são 5 por 15 min por e-mail e 20 por 15 min por IP, definidos como constantes num único arquivo.
- O IP vem do cabeçalho de proxy confiável. O nome do cabeçalho é configurável, porque depende da hospedagem, ainda indefinida.
- Ao estourar o limite, a mensagem é genérica ("Muitas tentativas. Tente de novo em alguns minutos."), com status de erro de formulário, sem revelar qual chave estourou.
- Os limites do Supabase Auth ficam altos, como rede de segurança. Antes de escrever o plano, conferir na documentação se o Supabase aceita o IP real do cliente vindo do servidor; se aceitar, repassá-lo também.

## 7. Erros

- Os adaptadores seguem os contratos dos ports: erro esperado volta como valor tipado. Falha de infraestrutura lança exceção, que cai nos `error.tsx` e nos toasts existentes.
- `lib/data/supabase/errors.ts` traduz os erros do Supabase (códigos do Auth e do PostgREST) para os erros dos ports. A mensagem crua nunca chega ao usuário.
- Os logs nunca levam token, `token_hash`, senha, CPF nem o corpo de requisições de auth.
- ViaCEP: `fetch` com timeout de 3 s. Erro, timeout ou CEP inexistente devolvem `null`.

## 8. Testes

- **pgTAP** (`supabase test db`): para cada tabela, os papéis anônimo, dono, outro usuário e admin, incluindo as operações que precisam falhar; as RPCs; e o teste de "nenhuma tabela sem RLS".
- **Contrato dos ports** (Vitest): um conjunto de testes por port, parametrizado pelo adaptador. Roda sempre contra o mock e, quando o Supabase local está disponível, contra o adaptador real.
- **E2E (Playwright):** a suíte atual continua em `DATA_SOURCE=mock`, com os testes ajustados para os novos fluxos (confirmação pendente). Entra uma suíte nova em `DATA_SOURCE=supabase` para cadastro → e-mail → confirmação → entrada e para a recuperação de senha, lendo os e-mails pela caixa de teste que o `supabase start` sobe (Inbucket/Mailpit). OAuth não entra no E2E; `/auth/callback` tem teste unitário.
- **Visual + axe** para as telas novas, em 1280 e 390.
- **CI:** job novo com `supabase start` → `supabase db reset` → pgTAP → contrato contra o Supabase → E2E de auth → checagem de que `database.types.ts` não diverge do schema. O deploy das migrations para a nuvem é um workflow separado (`supabase db push`, manual ou em push na `main` que altere `supabase/**`), com o secret `SUPABASE_ACCESS_TOKEN`.

## 9. Fora do escopo

- Pedidos, pagamento, frete e cupons (sub-projeto 2).
- CRUD de endereços, conexão e desconexão de provedores, exportação e exclusão de conta, unificação do consentimento de marketing, trocas (sub-projeto 3).
- Painel `/admin` e envio dos e-mails de "voltou ao estoque" (sub-projeto 4; aqui só gravamos os pedidos de aviso).
- Deploy do Next.

## 10. Depende do dono (não bloqueia o desenvolvimento)

- Criar o projeto no Supabase Cloud.
- Credenciais OAuth do Google e do Facebook (e Apple, se for ligar).
- Conta no Resend e domínio remetente verificado.
- Até lá, tudo roda no Supabase local.
