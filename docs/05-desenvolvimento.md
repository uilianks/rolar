# 05 — Desenvolvimento

## Rodar localmente

Não precisa de conta em nenhum serviço: a API usa **PGlite**, um Postgres em WASM salvo em
`.data/pglite`. O código de login aparece no terminal da API.

```bash
npm install
cp .env.example .env.local     # EXPO_PUBLIC_API_URL=http://localhost:8799
npm run dev:api                # API em http://localhost:8799/api (migra o banco ao subir)
npm run web                    # app em http://localhost:8081
npm run android                # Expo Go / dev build num celular ou emulador
```

### Com Postgres de verdade (Docker)

Para testar como em produção, com Postgres 17 e o **mesmo driver do Neon** (WebSocket), use
`compose.yaml`. Ele sobe o Postgres e um proxy que fala o protocolo do Neon:

```bash
npm run db:up         # sobe Postgres (porta 5432) + proxy Neon (4444)
npm run dev:api:pg    # API usando esse banco (migra ao subir)
npm run web
npm run db:reset      # apaga os dados e recomeça; db:down para desligar
```

Ou coloque no `.env.local`:
`DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/rolar`.

- `db.localtest.me` resolve para a sua máquina, mas precisa de DNS. Offline, acrescente
  `127.0.0.1 db.localtest.me` ao `/etc/hosts`.
- Para inspecionar o banco: `docker compose exec postgres psql -U postgres -d rolar`.
- Os testes automáticos continuam no PGlite em memória (rápidos e isolados).

### Dados de demonstração

`npm run db:seed` cria a academia aprovada "Demo BJJ Lisboa" com:
- professor dono (`demo.professor@example.com`), professora coach (`demo.coach@example.com`);
- 17 alunos (dois menores), 3 meses de treinos, seguidores, Oss e comentários;
- 4 pedidos de entrada e 3 graduações à espera de confirmação;
- 12 aulas na semana e 4 semanas de chamadas com tema da aula. As de anteontem ficaram "esquecidas"
  (aparecem em "Chamadas por fazer"), e uma segunda-feira foi cancelada por feriado;
- mural com avisos, 4 eventos (campeonato com inscritos, seminário, exame de graduação e um campeonato
  passado com medalhas);
- mensalidades: 4 planos e pagamentos dos últimos meses, com alunos em dia, a vencer, em atraso e
  bolsistas;
- dois alunos sem aparecer há 3 semanas ("Alunos sumidos").

Rodar de novo apaga e recria só os dados demo (`demo.*@example.com`). Usa o `DATABASE_URL` do
ambiente; com Docker: `DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/rolar npm run db:seed`.
Recusa rodar em produção ou num banco do Neon.

### Admin e celular

O painel `/admin` (números do app, verificação e edição de academias, denúncias, contas e feature
flags) aparece para os e-mails em `ADMIN_EMAILS`, no `.env.local` em dev e nas variáveis da Vercel em
produção. A API lê o `.env.local` ao subir.

No celular, use `EXPO_PUBLIC_API_URL=http://<IP-do-PC>:8799` e acrescente a origem do app em
`TRUSTED_ORIGINS`. O emulador Android acessa o PC por `10.0.2.2`, que é o padrão. Check-in (câmara) e
idioma do aparelho usam módulos nativos (`expo-camera`, `expo-localization`): no Android é preciso um
development build (`npx eas-cli build --profile development`), o Expo Go não basta.

### Vídeo de apresentação

`video/` é um projeto [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML + GSAP → MP4) com
telas reais do app (dados demo) em `video/assets/shots/`.

```bash
cd video
npm run check     # lint, layout, contraste
npm run render    # MP4 em video/renders/ (fora do git)
```

A trilha (`video/assets/music.m4a`) é sintetizada do zero por `video/music/compose.py` (numpy, sem samples,
sem direitos de terceiros), a 120 BPM para os cortes caírem na batida. Para regenerar:
`python3 music/compose.py && ffmpeg -i music/track.wav -af loudnorm=I=-16:TP=-1.5 -c:a aac -b:a 192k assets/music.m4a`.

Para atualizar as telas, rode `npm run db:seed` e capture-as de novo nas mesmas resoluções (celular 390×844 @3x,
desktop 1440×900 @2x).


## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev:api` | API em `:8799` com PGlite (`.data/pglite`); migra ao subir |
| `npm run dev:api:pg` | Mesma API contra o Postgres do Docker (`npm run db:up` antes) |
| `npm run web` | App web em `:8081` |
| `npm test` | Vitest: API inteira contra PGlite em memória (login real por código, regras de acesso, traduções) + estatísticas |
| `npm run typecheck` | `tsc --noEmit` (app, API e testes; acusa também chave faltando em `en.ts`) |
| `npm run lint` | ESLint (config do Expo) |
| `npm run db:generate` | Gera migração SQL a partir de `server/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações em `DATABASE_URL` |
| `npm run db:seed` | Recria os dados de demonstração |
| `npm run build:web` | Exporta o site estático para `dist/` |

## Estrutura

```
src/app/            telas (Expo Router)
  _layout.tsx         idioma, tema, estado de login → entrar | onboarding | (app)
  entrar.tsx          login por código de 6 dígitos (+ Google, se configurado), troca de idioma
  onboarding.tsx      4 passos: nome/idade, faixa, academia, privacidade/meta
  termos.tsx, privacidade.tsx   textos legais públicos (pt e en)
  (app)/              moldura com sidebar (≥ 900 px) ou dock
    index, registrar, timer, progresso, semana, treino/[id], perfil, u/[username], buscar,
    notificacoes, config, apoie, ler-qr, checkin
    academia/         index, buscar, nova, [id]/{index, calendario, chamada, horarios,
                      mensalidades, qr, evento/{novo,[eventId]}}
    admin/            index, academias, [id], denuncias, usuarios, usuario/[id], flags
src/ui/             tema (tokens de design/styles.css), kit de componentes, shell, cartões
src/lib/            cliente da API, Better Auth, React Query, idioma (i18n.tsx), formatação, tipos
src/shared/         usado pelo app E pela API
  domain.ts           domínio e validação (zod)
  i18n/               textos: pt.ts (fonte), en.ts (mesmo formato), escolha do idioma
server/             API Hono
  app.ts              idioma do pedido, CORS, CSRF, auth, sessão → rotas, erros traduzidos
  http.ts             fail(status, "chave"), validação do corpo, viewer/admin
  policies.ts         TODAS as regras de acesso (visibilidade, bloqueio, menores, staff)
  routes/             me, sessions, social, academies, promotions, classes, calendar, board,
                      billing, admin
  avatars.ts          fotos de perfil (Vercel Blob, ou tabela em dev)
  stats.ts            estatísticas no fuso do usuário (semana começa na segunda)
  vercel.ts           entrada da Vercel Function
  db/                 schema Drizzle, migrações, cliente Neon|PGlite, seed
scripts/            vercel-output.mjs (deploy pela Build Output API), smoke-api.mjs
tests/              testes de API, regras, estatísticas e traduções
design/             wireframes HTML do MVP
video/              vídeo de apresentação (HyperFrames)
```

## Traduções

Todo texto visível fica em `src/shared/i18n/`. `pt.ts` é a fonte e define o tipo `Messages`; `en.ts`
precisa ter o mesmo formato, e o typecheck acusa chave faltando ou sobrando. Textos com números ou
nomes são funções (`members: (n) => …`), o que resolve plurais sem biblioteca.

- **Componentes**: `const t = useT()` e `t.secao.chave`. Fora de componentes (formatadores, alertas):
  `msg()`.
- **Datas e números**: sempre por `src/lib/format.ts` (`dateFmt`, `euros`, `monthYear`…), que usam o
  locale do idioma ativo (`pt-PT` ou `en-GB`). Nada de `"pt-PT"` fixo no código.
- **API**: `fail(404, "planNotFound")` com chaves de `errors`; o servidor responde no `Accept-Language`
  do pedido (o app envia o idioma escolhido). Schemas zod usam chaves de `validation` como mensagem.
- **Textos longos** (termos, privacidade) ficam na própria página, um array por idioma.
- **Novo idioma**: criar `xx.ts` com o tipo `Messages`, acrescentar em `LOCALES` e `DICTIONARIES`
  (`src/shared/i18n/index.ts`) e as versões dos textos legais.

## Decisões tomadas durante a implementação

- **Código por e-mail no lugar de link mágico.** No Android, o link abre o navegador e o cookie de
  sessão precisaria voltar ao app por deep link. O plugin do Better Auth não guarda esse cookie
  sozinho. O código de 6 dígitos usa o mesmo fluxo na web e no Android, sem deep link.
- **Web como SPA** (`web.output: "single"`) e rewrite para `index.html` na Vercel. Pré-renderizar
  páginas públicas (SEO) fica para quando houver páginas públicas de verdade.
- **Instalável (PWA)**: `public/manifest.json` (`display: standalone`, ícones em `public/icons/`,
  gerados de `assets/images/icon.png`) ligado em `public/index.html`. Abre em janela própria, sem a
  barra do navegador. Sem service worker de propósito: um cache agressivo prende o app numa versão
  antiga, e o app precisa de rede para salvar de qualquer forma. Se vier o modo offline, entra aqui.
  No celular (web), a tela de login mostra como instalar (`src/ui/install-hint.tsx`): botão nativo no
  Chrome Android quando vem o `beforeinstallprompt`, passos do menu ⋮ nos outros e passos do Safari no
  iPhone. Some quando o app já abre da tela inicial ou depois de "Agora não".
- **Técnicas como lista de texto livre** no treino (`techniques text[]`). O catálogo estruturado e
  os rolas detalhados continuam na fase 2.
- **Menores só podem ser seguidos por membros ativos de uma academia em comum.** Isso soma à regra de
  nunca publicar para todos e de não aparecer na busca.
- **Notificações dentro do app** (tabela `notifications`). Push fica para a fase 2.
- **Traduções sem biblioteca** (15/10/2026): dicionários tipados em vez de i18next. São poucas
  línguas, o typecheck garante que nenhuma chave falta e o mesmo código serve o app e a API.
- **Ícones importados um a um** (`lucide-react-native/icons/<nome>`). Importar do pacote raiz punha
  1.500 ícones no bundle: 4,3 MB → 2,1 MB.

## Verificação feita

- Os testes de API, de estatísticas e de traduções passam (`npm test`, 12 arquivos); o CI roda o
  mesmo em cada push.
- Typecheck e lint estão limpos.
- Migrações conferem com o schema (`drizzle-kit check`).
- O build web e o bundle JS do Android compilam (`expo export -p web|android`).
- Dois fluxos completos no Chromium (Playwright) contra a API local, sem erros de console:
  1. **Uma pessoa**: login com código → onboarding criando academia → registrar treino → comentar →
     feed, progresso, perfil, academia, timer, configurações. Testado no celular (390 px) e no
     desktop.
  2. **Duas pessoas**:
     - a segunda pede para entrar e a dona aprova;
     - o treino vem do timer já preenchido;
     - a dona segue, dá Oss e confirma a graduação;
     - as notificações chegam.

- Fluxo de verificação de academia no navegador: cadastro no onboarding → admin recusa com motivo →
  dono é notificado, corrige e reenvia → admin aprova → academia aparece na busca.
- Os mesmos dois fluxos também passam contra o Postgres 17 do Docker, pelo driver do Neon.

**Não verificado:** o app nativo rodando num Android de verdade. Não há SDK nem dispositivo nesta
máquina, e o EAS precisa da conta Expo.
