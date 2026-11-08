# Pixel Perfect Artesanato — instruções para o Claude

Loja virtual de chaveiros e mimos de **pixel art feitos à mão com continhas (hama beads)**.
Vendas de itens prontos pelo site + **encomendas personalizadas pelo Direct do Instagram** (WhatsApp entra depois — o canal de contato deve ser configurável, ver briefing › Canal de contato).
Visual de **fliperama / videogame retrô** (tema escuro, fonte pixelada, sombras duras).

A especificação completa está em **`docs/briefing.md`** — leia antes de qualquer tarefa grande.
As telas de referência estão em **`docs/design/`** (veja "Como ler os arquivos de design" abaixo).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres, Auth com e-mail/Google/Apple/Facebook, Storage, RLS)
- Mercado Pago (Pix, cartão, boleto) com webhook
- Melhor Envio (frete e etiquetas)
- Resend + React Email (e-mails transacionais)
- GSAP + ScrollTrigger (parallax da home)
- Hospedagem: Vercel (plano pago, uso comercial)

## Dados (Supabase)

- `getData()` (`lib/data/index.ts`) escolhe o adaptador por `DATA_SOURCE` (`mock` ou `supabase`); catálogo, newsletter, engajamento, auth e limite de tentativas já têm adaptador Supabase, o resto é mock.
- Schema, RLS, seed e testes pgTAP em `supabase/`; mudanças de schema só por migration (`npx supabase migration new`), seguidas de `npm run db:types`. RLS ligado em toda tabela de `public`.
- A secret key (`service_role`) só entra por `lib/supabase/admin.ts` e `lib/supabase/auth-client.ts` (`server-only`). Logs nunca levam token, senha, CPF nem corpo de requisição de auth.
- Passo a passo e checklist de produção no `README.md` (seção Supabase).

## Regras de trabalho

- Idioma da interface: **português do Brasil**. Código, nomes de variáveis e commits podem ser em inglês.
- **Nunca invente preços, prazos, dados da empresa ou textos jurídicos.** Tudo que no design aparece entre colchetes (`[PREÇO]`, `[X] dias`, `[CNPJ]`…) é placeholder: mantenha como placeholder ou leia de configuração/banco, e liste o que falta no fim da tarefa.
- Siga os **tokens de design** (`docs/briefing.md` › Design system). Não use cantos arredondados, gradientes nem sombras desfocadas: o estilo é pixel, com bordas sólidas e sombras duras (`6px 6px 0`).
- Acessibilidade obrigatória: `<button>`/`<a>` reais, `label` em todo campo, `aria-label` em botões só com ícone, contraste AA, alvos de toque ≥ 44px, respeitar `prefers-reduced-motion` (desligar parallax e animações).
- Campos de formulário no celular com `font-size` ≥ 16px.
- LGPD: consentimentos opcionais **desmarcados por padrão**; nada de analytics/pixel de anúncio antes do aceite de cookies; cada usuário só acessa os próprios dados (RLS no Supabase).
- Segredos só em variáveis de ambiente (`.env.local`), nunca no código. Chaves de pagamento e service role **somente no servidor**.
- Antes de decisões de arquitetura ou de instalar bibliotecas novas não listadas aqui, pergunte.
- Prefira Server Components; use Client Components só onde há interação.

## Como ler os arquivos de design (`docs/design/**/*.dc.html`)

São protótipos em HTML de uma ferramenta de design. Use-os como **referência visual e de comportamento**, não copie a estrutura literalmente:

- Estilos estão inline (`style="…"`) — converta para classes Tailwind usando os tokens.
- `{{nome}}` é uma variável calculada no bloco `<script type="text/x-dc">` no fim do arquivo (função `renderVals()`); ali estão os dados de exemplo e os estados (abas, filtros, gavetas abertas).
- `<sc-for list="{{itens}}" as="item">` = um `.map()`; `<sc-if value="{{cond}}">` = renderização condicional.
- `onClick="{{fn}}"` = handler definido em `renderVals()`.
- Links como `href="Loja.dc.html"` indicam navegação entre telas — veja o mapa de rotas no briefing.
- Imagens `src="/_blob/…"` são as fotos em `docs/design/img/` (mapa no briefing).
- Não reutilize `support.js`, `<x-dc>`, `<helmet>` nem `DCLogic`: são do runtime da ferramenta.
- Pastas: `desktop/` (telas de computador), `celular/` (390px), `referencia/` (logo e conceito adiado — não implementar).
