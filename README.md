# Pixel Perfect Artesanato

Online store frontend (Next.js 16, App Router, Tailwind 4) with a mock data layer and a Supabase backend (`supabase/`) behind the same ports.
Spec and design references live in `docs/`; project rules in `CLAUDE.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # then adjust values
npx playwright install chromium
```

## Commands

| Command                           | What it does                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                     | Dev server on http://localhost:3000                                    |
| `npm run build` / `npm start`     | Production build / server                                              |
| `npm run lint`                    | ESLint (zero warnings allowed)                                         |
| `npm run lint:fix`                | ESLint with autofix                                                    |
| `npm run format` / `format:check` | Prettier write / check                                                 |
| `npm run typecheck`               | `tsc --noEmit`                                                         |
| `npm test`                        | Vitest unit tests                                                      |
| `npm run e2e`                     | Playwright (desktop + mobile projects); builds and serves on port 3100 |
| `npm run check`                   | lint + format:check + typecheck + unit tests                           |
| `npm run e2e:visual`              | Same Playwright suite inside Docker with `VISUAL=1` (screenshots)      |
| `npm run storybook`               | Storybook on http://localhost:6006                                     |
| `npm run build-storybook`         | Static Storybook build (`storybook-static/`)                           |
| `npm run test:a11y-stories`       | Builds Storybook and runs axe on every story                           |

`SESSION_SECRET` (only with `DATA_SOURCE=mock`) must have 32+ characters. Visual baselines (`VISUAL=1`) run only in Docker.

## Supabase (backend)

O catálogo e a autenticação rodam no Supabase (Postgres, Auth, RLS). As migrations, o seed, os testes de banco e os templates de e-mail ficam em `supabase/`.

**Subir o ambiente local** (precisa do Docker; se `docker info` não responder, rode `wsl --shutdown` e reinicie o Docker Desktop):

```bash
npm run db:start                 # supabase start (Postgres, Auth, Studio, Mailpit)
npx supabase status -o env       # copie API_URL, PUBLISHABLE_KEY e SECRET_KEY para .env.local:
                                 #   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
# em .env.local: DATA_SOURCE=supabase
npm run dev
```

Os e-mails de confirmação e de nova senha chegam no Mailpit (http://127.0.0.1:54324). `npm run db:reset` recria o banco com as migrations e o seed; `npm run db:stop` desliga tudo.

**Criar uma migration:** `npx supabase migration new <nome>`, escreva o SQL em `supabase/migrations/`, rode `npm run db:reset` e depois `npm run db:types` (regenera `lib/supabase/database.types.ts`; o CI falha se o arquivo estiver desatualizado). RLS é obrigatório em toda tabela de `public`.

**Testes:**

| Comando                    | O que roda                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| `npm run db:test`          | pgTAP (`supabase test db`): RLS, triggers, funções                             |
| `npm run test:integration` | Vitest contra o Supabase local (as chaves vêm de `supabase status`)            |
| `npm run e2e:supabase`     | Playwright contra o app com `DATA_SOURCE=supabase` (cadastro, login, catálogo) |

O CI (`.github/workflows/ci.yml`) roda `check` e, em job separado, tudo acima. O E2E mock (`npm run e2e`) não roda no CI: rode-o localmente.

**Deploy das migrations:** `.github/workflows/deploy-db.yml` roda a cada push na `main` que altere `supabase/**` (ou manualmente) com `supabase link` + `supabase db push`. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` e `SUPABASE_PROJECT_REF`. Sem `SUPABASE_PROJECT_REF` o job só emite um aviso (o projeto na nuvem ainda não existe).

**Checklist de produção:**

- `CLIENT_IP_HEADER` deve nomear um cabeçalho que a hospedagem sobrescreve; senão a primeira entrada de `x-forwarded-for` é controlada pelo cliente e burla o limite de tentativas.
- Nunca publique um build com `DATA_SOURCE=mock`: as rotas `/api/__mock__/*` (inclusive a caixa de e-mails com links vivos de confirmação e recuperação) ficam abertas nesse modo.
- A lista de redirecionamentos do GoTrue (`additional_redirect_urls`) precisa cobrir `<site>/auth/confirm?next=*` e `<site>/auth/callback*`, senão os links dos e-mails quebram.
- Crie no Vault os segredos `site_url` e `revalidate_secret` (mesmo valor de `REVALIDATE_SECRET`); sem eles o gatilho de revalidação não faz nada. Ao trocar o segredo, limpe também as linhas de `net.http_request_queue` e `net._http_response`, que guardam o cabeçalho Bearer antigo.
- Ligue o "IP Address Forwarding" do Supabase Auth (`security_sb_forwarded_for_enabled`; Authentication → Rate Limits ou Management API) depois de criar o projeto.
- SMTP do Resend (`RESEND_SMTP_HOST`, `RESEND_SMTP_USER`, `RESEND_SMTP_PASS`) com remetente real no lugar de `[PLACEHOLDER]`, e credenciais OAuth do Google e do Facebook (ver `docs/PENDENCIAS.md` §1).
- **A configuração do Auth não vai pelo `deploy-db.yml`** (ele só aplica migrations). Antes de abrir a loja, rode `supabase config push` depois de trocar `site_url` e o remetente `[PLACEHOLDER]` em `supabase/config.toml`, ou configure no painel os templates de e-mail, os redirecionamentos e a confirmação de e-mail. Com os templates padrão do Supabase os links não passam por `/auth/confirm` e a confirmação quebra.
- Limites do GoTrue na nuvem, por IP: `token_verifications` 30 a cada 5 min (links dos e-mails e códigos OAuth) e `token_refresh` 150 a cada 5 min. A verificação de link e a troca de código OAuth repassam o IP do usuário (`sb-forwarded-for`). A renovação de sessão no proxy usa a chave publicável e não repassa: todos os usuários contam no IP do servidor. Aumente os limites no painel (Authentication → Rate Limits) se for preciso. Um 429 nos links leva a `/entrar?erro=tente-de-novo`, e o link continua valendo.

## Padrões de código

- **Formatar ao salvar:** o repositório traz `.vscode/settings.json` (Prettier como formatador e `eslint --fix` ao salvar). Aceite as extensões recomendadas em `.vscode/extensions.json` (ESLint, Prettier, Tailwind CSS IntelliSense, Playwright, Vitest, EditorConfig). O Prettier ordena as classes Tailwind (inclusive dentro de `cn()` e `cva()`).
- **Hooks (Husky):** `pre-commit` roda `lint-staged` (ESLint com zero avisos + Prettier nos arquivos em stage), `commit-msg` valida a mensagem com commitlint e `pre-push` roda `typecheck` e `test`. Nunca use `--no-verify`.
- **Commits (Conventional Commits, em inglês):** `tipo(escopo): descrição`. Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `revert`. Escopos sugeridos (aviso, não erro): `ui, layout, home, shop, product, cart, auth, checkout, payment, account, orders, custom-orders, legal, returns, lgpd, data, deps, tooling, e2e`.
  - `feat(cart): add undo for removed items`
  - `fix(checkout): keep coupon after address change`
  - `chore(deps): bump vitest`
- **Testes visuais:** `npm run e2e:visual` roda a suíte Playwright inteira dentro do container oficial (`docker/playwright.sh` faz `npm ci` num volume nomeado, para não misturar binários Linux e Windows). Os argumentos depois de `--` vão direto para o `playwright test`: `npm run e2e:visual -- smoke`, `npm run e2e:visual -- --repeat-each=3` (estabilidade) etc. Fora do Docker os `snap()` não comparam nada.
- **Baselines nascem e são comparados só no container** (o mesmo que um CI usará); nunca gere PNG no Windows. Para atualizar, **só depois de revisar a tela** contra o `.dc.html` correspondente: `npm run e2e:visual -- --update-snapshots -g "<nome>"` (ou `--update-snapshots=all` com o arquivo do spec para regenerar tudo dele) e revise o diff dos PNG antes do commit. A tolerância é 1% de pixels, então mudanças pequenas de texto podem passar despercebidas: confira o diff.
- **Varreduras de qualidade:** `tests/e2e/a11y-sweep.spec.ts` percorre todas as rotas (lista em `tests/e2e/support/routes.ts`) nos dois projetos e exige axe sem violações, alvos interativos de pelo menos 44x44 (exceto links dentro de parágrafo, `p a`), nenhum `border-radius` fora de `.bead`, sem overflow horizontal no celular e console sem erros. `tests/e2e/visual-sweep.spec.ts` tira um snapshot de cada rota. Rotas logadas usam o usuário `ana`, e `/checkout` recebe um item no carrinho.
- **Pendências e handoff do backend:** veja `docs/PENDENCIAS.md` (placeholders, decisões do dono, obrigações do backend e as assinaturas dos ports em `lib/data/ports.ts`).
- **Docker travado:** se `docker info` não responder, rode `wsl --shutdown` e reinicie o Docker Desktop.

## Dependências e segurança

- `.npmrc` usa `min-release-age=14`: só se instalam versões publicadas há 14 dias ou mais (proteção de supply chain) e `save-exact=true`.
- Um aviso de segurança tem prioridade sobre essa regra: fixe a primeira versão corrigida, instale uma única vez com `npm install --min-release-age=N` (N = idade em dias dessa versão; só na linha de comando, o `.npmrc` não muda) e registre o motivo no commit.
- Verificação: `npm audit --omit=dev` ainda aponta `fast-uri` (via `@hookform/resolvers` → `ajv`); o item está em `docs/PENDENCIAS.md` §4 e deve ser resolvido antes do lançamento.

## Lighthouse (mobile)

Medido em 2026-10-30 com o Lighthouse CLI 13.5.0 (`npx lighthouse@13.5.0`, sem entrar no `package.json`; a versão tem mais de 14 dias, então respeita o `min-release-age`), preset mobile padrão (Moto G Power, 4G lento simulado), contra o build de produção com dados mock (`npm run build && npm run start -- -p 3100` com as mesmas variáveis do `webServer` em `playwright.config.ts`) e o Chrome instalado.

| Rota                     | Performance | Acessibilidade | LCP   | TBT   | CLS |
| ------------------------ | ----------- | -------------- | ----- | ----- | --- |
| `/`                      | 92          | 100            | 3,3 s | 100ms | 0   |
| `/loja`                  | 92          | 100            | 3,3 s | 50ms  | 0   |
| `/produto/garota-pixel`  | 91          | 100            | 3,5 s | 30ms  | 0   |
| `/checkout` (com 1 item) | 99          | 100            | 2,0 s | 70ms  | 0   |

Antes das otimizações: 90 / 91 / 91 / 97 de performance (acessibilidade 100 em todas). Mudanças: o GSAP deixou de entrar no bundle inicial da home (`lib/parallax.ts` é importado com `import()` depois da hidratação) e a fonte Silkscreen (só acentos maiúsculos raros) deixou de ser pré-carregada em todas as páginas. A imagem principal da home e do produto já usava `next/image` com `sizes` e pré-carregamento.

Como repetir (Git Bash; ajuste `CHROME_PATH` para o seu Chrome):

```bash
# 1. build de produção + servidor na porta 3100 (mesmas variáveis do webServer em playwright.config.ts)
export DATA_SOURCE=mock SESSION_SECRET=e2e-secret-e2e-secret-e2e-secret-00   NEXT_PUBLIC_SITE_URL=http://localhost:3100 NEXT_PUBLIC_INSTAGRAM_USER=pixelperfect.teste   NEXT_PUBLIC_ANALYTICS_SRC=/__analytics-test.js
npm run build && npm run start -- -p 3100 &

# 2. rotas sem login
export CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
for p in / /loja /produto/garota-pixel; do
  npx lighthouse@13.5.0 "http://localhost:3100$p" --form-factor=mobile     --only-categories=performance,accessibility --chrome-flags="--headless=new"     --output=json --output-path="lh$(echo $p | tr / _).json"
done
```

`/checkout` redireciona para `/carrinho` com o carrinho vazio: abra o Chrome com `--remote-debugging-port=9333 --headless=new about:blank`, grave no `localStorage` de `http://localhost:3100` a chave `pp_cart_v1` = `{"state":{"lines":[{"productId":"garota","ring":"mosquetao","qty":1}]},"version":1}` (por exemplo com `chromium.connectOverCDP` do Playwright) e rode `npx lighthouse@13.5.0 http://localhost:3100/checkout --port=9333 --disable-storage-reset --form-factor=mobile --only-categories=performance,accessibility`. Encerre o servidor e o Chrome no fim. As notas variam 1 a 3 pontos entre execuções.
