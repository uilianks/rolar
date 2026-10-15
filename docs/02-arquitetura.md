# 02 — Arquitetura

## Visão geral

```
 um repositório, um projeto na Vercel
 ┌──────────────────────────────────────────────────────────────┐
 │ app/  Expo (React Native + Expo Router, TypeScript)          │
 │   ├─ web     → `expo export -p web` (SPA estática) → Vercel  │
 │   └─ Android → EAS Build (grátis) ou build local → Play Store│
 │                         │ fetch /api/*                        │
 │ api/  Hono em Vercel Functions (Node)                         │
 │   ├─ Better Auth  (/api/auth/*)                               │
 │   ├─ rotas da app (/api/sessions, /api/feed, …) + zod         │
 │   └─ Drizzle ORM ──────────────► Neon Postgres (Marketplace)  │
 └──────────────────────────────────────────────────────────────┘
```

iOS fica para depois: o mesmo código Expo compila para iOS quando houver a conta Apple.

## Peças e por quê

| Peça | Escolha | Motivo |
|---|---|---|
| UI | **Expo + Expo Router** | Um código para web e Android (e iOS depois). Web sai como site estático, com páginas públicas pré-renderizadas para SEO/compartilhamento. |
| API | **Hono** em `api/[[...route]].ts` (Vercel Function) | Pequeno, estável, roda nativo na Vercel. As API routes do próprio Expo ainda são experimentais e miram o EAS Hosting; não vale o risco. Web chama a mesma origem (sem CORS); o app Android chama a URL de produção. |
| Banco | **Neon Postgres** via Vercel Marketplace | Conta e variáveis de ambiente criadas pela própria Vercel. Escala a zero sem "pausar o projeto" (só um cold start de ~segundos). Branches de banco por preview deploy. |
| ORM/migrações | **Drizzle** + `drizzle-kit` (migrações SQL versionadas) | Tipos do banco no TypeScript, driver serverless do Neon. |
| Login | **Better Auth** (open source, tabelas no próprio Neon) | **Código de 6 dígitos por e-mail** + Google (opcional). O plugin oficial para Expo guarda a sessão no SecureStore. Sem Apple por enquanto: só é exigido com app iOS. O código substituiu o link mágico ([05](05-desenvolvimento.md#decisões-tomadas-durante-a-implementação)). |
| E-mail | **Resend** (plano grátis) | Envio dos códigos de login (em dev, o código aparece no terminal). |
| Autorização | **Na API**, em funções de política por recurso (`canReadSession(viewer, session)`), testadas | Sem Supabase não há RLS pronta; centralizar as regras num módulo evita checagens espalhadas. |
| Validação | **zod**, schemas compartilhados entre app e API | Mesma regra no formulário e no servidor. |
| Dados no app | TanStack Query | Cache, paginação do feed, modo offline básico. |
| Fotos | **Adiadas para a fase 2** | MVP sem fotos de treino (avatar vem do Google ou iniciais). Na fase 2: Cloudflare R2 (10 GB grátis, sem custo de saída) com upload direto por URL assinada. |
| Push | `expo-notifications` + Expo Push (fase 2) | Grátis. |
| Testes | Vitest; API testada contra **PGlite** (Postgres em WASM, sem Docker) | Testes das políticas de acesso rodam rápidos no CI. PGlite também é o banco de desenvolvimento; quem quiser Postgres real usa `compose.yaml` (Postgres + proxy do Neon). |
| CI | GitHub Actions: lint, typecheck, testes, `drizzle-kit check`; deploy pela integração Git da Vercel | |

## Backup

O Neon grátis só guarda algumas horas de histórico para restauração. Por isso: GitHub Action diária com
`pg_dump` → **criptografado com `age`** → artefato do Actions (o repositório é público, então o dump
nunca pode ir em claro). A chave privada fica só com você.

## Orçamento de uso (Vercel Hobby)

Só a API consome função: ~1 M invocações e 4 h de CPU ativa por mês. Um usuário ativo que abre o app
e registra um treino gera ~20–50 chamadas/dia → cabe com folga até alguns milhares de usuários
ativos. O site estático não conta como invocação.

## Lições do Strava aplicadas

- **Flags por usuário resolvidas no servidor**: tabela
  `feature_flags` devolvida no `/api/me`; nada de serviço de experimentos.
- **Páginas públicas separadas das logadas** (landing-pages × core): perfil, treino e academia
  públicos pré-renderizados e compartilháveis; o resto atrás do login.
- **Preview para compartilhamento** (`/activities/[id]/preview_share`): imagem OG do treino com
  `@vercel/og` — é assim que o app cresce no Instagram/WhatsApp.
- **Privacidade como feature** (mudar visibilidade de treinos passados, esconder dados sensíveis).
- **Moderação desde o início**: denúncia + bloqueio.
- **Não repetir** os três frontends convivendo: um app, uma API.

## Alternativas descartadas

| Opção | Por que não |
|---|---|
| Supabase | Substituído pelo Neon a pedido (integração nativa com a Vercel); exigiria menos código (RLS, auth, storage prontos), mas pausa projetos grátis inativos. |
| Neon Auth (auth gerenciado do Neon) | Mais um serviço externo; Better Auth no próprio banco é igualmente grátis e portátil. |
| Next.js (web) + Expo (mobile) | Duas UIs para manter. |
| Next.js + Capacitor | Experiência de "site embrulhado" no Android. |
| Vercel Blob para fotos | Cota grátis menor que o R2 e conta no limite do Hobby. |
