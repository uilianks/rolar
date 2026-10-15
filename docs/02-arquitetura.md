# 02 — Arquitetura

## Visão geral

```
 um repositório, um projeto na Vercel
 ┌──────────────────────────────────────────────────────────────┐
 │ src/  Expo (React Native + Expo Router, TypeScript)          │
 │   ├─ web     → `expo export -p web` (SPA estática) → Vercel  │
 │   └─ Android → EAS Build (grátis) ou build local → Play Store│
 │                         │ fetch /api/*                        │
 │ server/  Hono numa Vercel Function (Node, bundle ESM)         │
 │   ├─ Better Auth  (/api/auth/*)                               │
 │   ├─ rotas da app (/api/sessions, /api/feed, …) + zod         │
 │   ├─ Drizzle ORM ──────────────► Neon Postgres (Frankfurt)    │
 │   └─ fotos de perfil ──────────► Vercel Blob (privado)        │
 │ src/shared/  domínio, validação e textos (pt/en) dos dois     │
 └──────────────────────────────────────────────────────────────┘
```

iOS fica para depois: o mesmo código Expo compila para iOS quando houver a conta Apple.

## Peças e por quê

| Peça | Escolha | Motivo |
|---|---|---|
| UI | **Expo + Expo Router** | Um código para web e Android (e iOS depois). Web sai como site estático, com páginas públicas pré-renderizadas para SEO/compartilhamento. |
| API | **Hono** em `server/`, servido por `server/vercel.ts` | Pequeno, estável, roda nativo na Vercel. As API routes do próprio Expo ainda são experimentais e miram o EAS Hosting; não vale o risco. Web chama a mesma origem (sem CORS); o app Android chama a URL de produção. O deploy usa a Build Output API (`scripts/vercel-output.mjs`): a API vai num bundle ESM, porque o compilador da Vercel gerava CommonJS e o Better Auth só existe em ESM. |
| Banco | **Neon Postgres** via Vercel Marketplace | Conta e variáveis de ambiente criadas pela própria Vercel. Escala a zero sem "pausar o projeto" (só um cold start de ~segundos). Branches de banco por preview deploy. |
| ORM/migrações | **Drizzle** + `drizzle-kit` (migrações SQL versionadas) | Tipos do banco no TypeScript, driver serverless do Neon. |
| Login | **Better Auth** (open source, tabelas no próprio Neon) | **Código de 6 dígitos por e-mail** + Google (opcional). O plugin oficial para Expo guarda a sessão no SecureStore. Sem Apple por enquanto: só é exigido com app iOS. O código substituiu o link mágico ([05](05-desenvolvimento.md#decisões-tomadas-durante-a-implementação)). |
| E-mail | **Resend** (plano grátis) | Envio dos códigos de login (em dev, o código aparece no terminal). |
| Autorização | **Na API**, em funções de política por recurso (`canReadSession(viewer, session)`), testadas | Sem Supabase não há RLS pronta; centralizar as regras num módulo evita checagens espalhadas. |
| Validação | **zod**, schemas compartilhados entre app e API | Mesma regra no formulário e no servidor. |
| Dados no app | TanStack Query | Cache, paginação do feed, modo offline básico. |
| Fotos | **Vercel Blob privado** (fotos de perfil) | O app recorta e reduz a 256×256 JPEG (~5–20 KB); a API guarda no Blob e serve por `/api/avatars/:id`. Sem credenciais do Blob (dev, testes) ficam na tabela `avatars`. Fotos de treino continuam na fase 2; com volume, reavaliar Cloudflare R2 (sem custo de saída). |
| Textos / idiomas | Dicionários tipados em `src/shared/i18n/` (pt é a fonte, en tem o mesmo formato) | Sem biblioteca: o typecheck acusa chave faltando. O app segue o idioma do aparelho (`expo-localization`) ou o escolhido em Configurações; a API responde no `Accept-Language` do pedido (erros, validação, e-mail de login, CSV). |
| Push | `expo-notifications` + Expo Push (fase 2) | Grátis. |
| Testes | Vitest; API testada contra **PGlite** (Postgres em WASM, sem Docker) | Testes das políticas de acesso rodam rápidos no CI. PGlite também é o banco de desenvolvimento; quem quiser Postgres real usa `compose.yaml` (Postgres + proxy do Neon). |
| CI | GitHub Actions: typecheck, lint, testes, `drizzle-kit check`, build web e teste de fumaça do bundle da API; deploy pela integração Git da Vercel | |

## Backup

O Neon grátis só guarda algumas horas de histórico para restauração. Por isso: GitHub Action diária com
`pg_dump` → **criptografado com `age`** → artefato do Actions (o repositório é público, então o dump
nunca pode ir em claro). A chave privada fica só com você.

O workflow (`.github/workflows/backup.yml`) já existe, mas **está desligado**: só roda com a variável
`BACKUP_ENABLED=true` e os segredos do banco e da chave pública `age` configurados no GitHub.

## Orçamento de uso (Vercel Hobby)

Só a API consome função: ~1 M invocações e 4 h de CPU ativa por mês. Um usuário ativo que abre o app
e registra um treino gera ~20–50 chamadas/dia → cabe com folga até alguns milhares de usuários
ativos. O site estático não conta como invocação.

## Lições do Strava aplicadas

- ✅ **Flags por usuário resolvidas no servidor**: tabela `feature_flags` devolvida no `/api/me`,
  geridas em `/admin/flags`; nada de serviço de experimentos.
- ⏳ **Páginas públicas separadas das logadas** (landing-pages × core): perfil, treino e academia
  públicos pré-renderizados e compartilháveis; o resto atrás do login. Hoje a web é toda SPA.
- ⏳ **Preview para compartilhamento** (`/activities/[id]/preview_share`): imagem OG do treino com
  `@vercel/og` — é assim que o app cresce no Instagram/WhatsApp.
- ✅ **Privacidade como feature** (mudar visibilidade de treinos passados, esconder dados sensíveis).
- ✅ **Moderação desde o início**: denúncia, bloqueio e fila de moderação no admin.
- **Não repetir** os três frontends convivendo: um app, uma API.

## Alternativas descartadas

| Opção | Por que não |
|---|---|
| Supabase | Substituído pelo Neon a pedido (integração nativa com a Vercel); exigiria menos código (RLS, auth, storage prontos), mas pausa projetos grátis inativos. |
| Neon Auth (auth gerenciado do Neon) | Mais um serviço externo; Better Auth no próprio banco é igualmente grátis e portátil. |
| Next.js (web) + Expo (mobile) | Duas UIs para manter. |
| Next.js + Capacitor | Experiência de "site embrulhado" no Android. |
| Cloudflare R2 já para as fotos de perfil | Mais uma conta e credenciais; as fotos de perfil (~10 KB cada) cabem com folga na cota do Vercel Blob. Volta a ser opção para as fotos de treino. |
