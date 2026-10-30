# Pixel Perfect Artesanato

Online store frontend (Next.js 16, App Router, Tailwind 4) with a mock data layer.
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

`SESSION_SECRET` must have 32+ characters. Visual baselines (`VISUAL=1`) run only in Docker.

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
- Verificação: `npm audit --omit=dev` deve terminar sem vulnerabilidades.

## Lighthouse (mobile)

Medido em 2026-10-30 com o Lighthouse CLI 13.5.0 (`npx lighthouse@13.5.0`, sem entrar no `package.json`; a versão tem mais de 14 dias, então respeita o `min-release-age`), preset mobile padrão (Moto G Power, 4G lento simulado), contra o build de produção com dados mock (`npm run build && npm run start -- -p 3100` com as mesmas variáveis do `webServer` em `playwright.config.ts`) e o Chrome instalado.

| Rota                     | Performance | Acessibilidade | LCP   | TBT   | CLS |
| ------------------------ | ----------- | -------------- | ----- | ----- | --- |
| `/`                      | 92          | 100            | 3,3 s | 100ms | 0   |
| `/loja`                  | 92          | 100            | 3,3 s | 50ms  | 0   |
| `/produto/garota-pixel`  | 91          | 100            | 3,5 s | 30ms  | 0   |
| `/checkout` (com 1 item) | 99          | 100            | 2,0 s | 70ms  | 0   |

Antes das otimizações: 90 / 91 / 91 / 97 de performance (acessibilidade 100 em todas). Mudanças: o GSAP deixou de entrar no bundle inicial da home (`lib/parallax.ts` é importado com `import()` depois da hidratação) e a fonte Silkscreen (só acentos maiúsculos raros) deixou de ser pré-carregada em todas as páginas. A imagem principal da home e do produto já usava `next/image` com `sizes` e pré-carregamento.

Como repetir: suba o build de produção na porta 3100, e rode `npx lighthouse@13.5.0 http://localhost:3100/ --form-factor=mobile --only-categories=performance,accessibility` (com `CHROME_PATH` apontando para um Chrome). O `/checkout` redireciona para `/carrinho` com o carrinho vazio: o item precisa estar no `localStorage` (`pp_cart_v1`) do Chrome auditado (abra o Chrome com `--remote-debugging-port=9333`, grave a chave e passe `--port=9333 --disable-storage-reset` ao Lighthouse). As notas variam 1 a 3 pontos entre execuções.
