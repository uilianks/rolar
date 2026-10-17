# 03 — Modelo de dados

Postgres no Neon, esquema em Drizzle (`server/db/schema.ts`, migrações em `server/db/migrations/`). As
tabelas de login (`user`, `session`, `account`, `verification`, `rate_limit`) são do Better Auth;
`profiles` estende `user` 1:1.

O desenho abaixo é o plano original, com o que mudou anotado. As tabelas que vieram depois estão em
[Como ficou na implementação](#como-ficou-na-implementação-15102026).

```
profiles        user_id · username · name · avatar_url · birth_year
                belt (12 faixas kids IBJJF + white|blue|purple|brown|black) · stripes 0–6
                home_academy_id · started_at · weekly_goal · default_visibility
                searchable · show_in_ranking      (menor = derivado de birth_year; sem peso)
                seen_achievements text[]?  (conquistas já parabenizadas; null = ainda não verificado)

academies       id · name · slug · city · country · lat/lng (opcional) · created_by
academy_members academy_id · user_id · role (owner|coach|student) · status (pending|active) · joined_at

sessions        id · user_id · academy_id? · started_at · duration_min
(treinos)       kind (gi|nogi|open_mat|drill|competition|private|teaching) · rounds · rpe 1–10?
                notes · visibility (public|followers|private) · source (manual|timer|checkin|health)
                review_pending (criado pelo check-in, ainda sem resposta a "Como foi o treino?")

                techniques text[]  (lista livre; o catálogo abaixo é da fase 2)
                submissions jsonb, taps jsonb  ([{name, count}]: finalizações que pegou / em que bateu)

rolls (fase 2)  session_id · partner_user_id? · partner_name? · partner_belt
                outcome (sub_win|sub_loss|points|draw|flow) · technique_id?
techniques      id · academy_id? · author_id? · name (único por academia, sem caixa) · name_en? · aliases text[]
                (sem academia = catálogo do Rolar, bilíngue; base inicial na migração 0012)
(catálogo)      category (takedown|guard|pass|sweep|control|submission|escape)
                position? (standing|closed_guard|open_guard|half_guard|side_control|mount|
                knee_on_belly|back|turtle|leg_entanglement) · description · description_en? (só texto)
technique_links from_id · to_id   ("leva a", só dentro da mesma academia; vira o mapa de técnicas)
known_techniques user_id · technique_id   ("eu sei esta técnica", marcado pelo próprio atleta)
technique_notes  user_id · technique_id · body   (notas privadas do atleta)
session_techniques (f2)  session_id · technique_id
session_media (fase 2)  session_id · object_key · width · height

promotions      user_id · belt · stripes · promoted_at · academy_id · confirmed_by (coach)?

follows         follower_id · followee_id · created_at
reactions       session_id · user_id   ("Oss")
comments        id · session_id · user_id · body · created_at
blocks          blocker_id · blocked_id
reports         id · reporter_id · target_type · target_id · reason · status
push_tokens (fase 2)  user_id · token · platform
feature_flags   key · enabled_for (all | lista de user_id)
```

## Regras de acesso (módulo `server/policies.ts`, uma função por recurso)

- **Treinos**: o dono lê e escreve. Os outros só leem se:
  - o treino for `public`, ou
  - for `followers` e eles seguirem o dono.
  Em qualquer caso, ninguém lê se houver bloqueio em qualquer direção.
- **Perfil**: `birth_year` só aparece para o dono. Para isso existe um serializer público separado,
  sem esse campo.
- **Academia**:
  - o aluno cria um pedido `pending`;
  - só `owner|coach` ativo aprova ou muda o papel de alguém.
- **Graduação**: só `coach|owner` ativo da academia preenche `confirmed_by`.
- **Técnicas** (`canManageTechnique`):
  - qualquer usuário logado lê as técnicas do Rolar e as de academias aprovadas, e os mapas;
  - o catálogo do Rolar (sem academia) só o admin escreve, em português e inglês; a API responde no
    idioma do pedido;
  - só `owner|coach` ativo da academia cria, edita ou apaga, e as ligações só apontam para técnicas
    da mesma academia;
  - admin cria, edita e apaga técnicas de qualquer academia aprovada (painel admin → Técnicas,
    escolhendo a academia).
- **Meu mapa de técnicas** (`/techniques/known`): só o próprio atleta vê. Entram as técnicas que ele
  marcou como sabidas e as que ele anotou num treino (nome, nome em inglês ou outro nome, sem
  diferenciar maiúsculas): das academias em que é membro ativo, ou do Rolar quando nenhuma dessas
  academias tem uma técnica com aquele nome (a versão da academia vence).
- **Menores (13–17)**:
  - perfil e treinos privados por padrão;
  - fora da busca e de "sugestões de quem seguir";
  - a visibilidade não pode ir para `public`.
- **Cadastro**: menores de 13 são recusados. O ano de nascimento é autodeclarado.

Todas as rotas passam pela política correspondente. Os testes cobrem cada regra, tanto o caso
permitido quanto o negado.

## Feed

No MVP é uma consulta direta:
- `sessions` de quem eu sigo e da minha academia;
- só as que eu posso ler, pela mesma regra da política;
- ordenadas por `started_at`, com paginação por cursor.

Não haverá tabela de feed pré-montada até o volume justificar.

## Estatísticas

Agregadas em SQL, num endpoint `/api/me/stats`:
- horas por semana e por mês;
- sequência de dias treinados;
- distribuição por modalidade;
- carga semanal (Σ duração × RPE), comparada com a média das últimas 4 semanas para classificar em
  baixa, ideal ou alta.

## Exclusão de conta

Exigida pelo RGPD e pelas lojas. Apagar a conta remove em cascata:
- todos os dados do usuário;
- os comentários e reações dele em treinos de outras pessoas.

## Como ficou na implementação (15/10/2026)

- O schema real está em `server/db/schema.ts`; as migrações, em `server/db/migrations/`.
- As regras acima estão em `server/policies.ts`, com testes em `tests/api.test.ts`.
- **Menores**: além das regras acima, só podem ser seguidos por membros ativos de uma academia em
  comum (`canFollow`).
- **Técnicas**: por enquanto são uma lista de texto livre no treino (`sessions.techniques text[]`).
  A tabela `techniques` e os `rolls` ficaram para a fase 2.
- **Tabelas extras**:
  - `notifications`: social (Oss, comentário, seguidor), entrada na academia (pedido, aprovação,
    recusa, remoção, virar ou deixar de ser professor, transferência de dono), graduação, e o que
    o staff muda na academia (grade de horários, aula cancelada ou de volta, evento publicado,
    alterado ou cancelado, resultado em competição, aviso no mural, mensalidade). Os tipos ficam em
    `server/notify.ts`; avisos repetidos de grade e de evento alterado se juntam enquanto não lidos;
  - `rate_limit`: contadores do Better Auth.
- **Verificação de academias** (`academies.status`: `pending` → `approved` | `rejected`):
  - o cadastro exige morada, cidade, país, telefone, site ou Instagram, o papel de quem pede e como confirmar;
  - quem cadastra vira dono na hora, mas a academia fica fora da busca, não aceita pedidos de entrada nem
    treinos marcados nela até um admin aprovar. Para os outros, ela responde 404;
  - recusar exige um motivo. O dono corrige e reenvia (`PUT /academies/:id`), e ela volta para a fila;
  - uma pessoa só tem um cadastro aberto (pendente ou recusado) por vez;
  - admins são os e-mails em `ADMIN_EMAILS`. O painel está em `/admin` e a API em `/api/admin/*`.
- **Horários e chamada**:
  - `academy_classes`: aulas semanais (dia ISO, hora local, duração, modalidade). São públicas como a
    morada; só professores editam. Remover arquiva a aula, para as chamadas antigas não se perderem;
  - `attendance` (aula, data, aluno): só professores marcam, de aulas dos últimos 60 dias e no dia certo
    da semana. Quem é marcado pela primeira vez recebe `attendance_confirmed`, que abre "Registrar treino"
    já preenchido com a aula;
  - **Aluno registrou, professor esqueceu**: um treino do aluno na academia, no mesmo dia e até 2 h do
    início da aula, aparece na chamada como "registrou treino nesta aula", com "Confirmar todos". As
    aulas dos últimos 7 dias sem chamada mas com treinos registrados aparecem para os professores em
    "Chamadas por fazer". O registro do aluno não vira presença sozinho: é um pedido;
  - **Professor marcou, aluno não registrou**: a presença vale do mesmo jeito (é o registro do
    professor), e o aluno recebe o lembrete para registrar o treino;
  - marcado por engano: o professor desmarca na mesma tela. O aluno não mexe na chamada;
  - a lista de membros mostra aos professores as presenças de cada um nos últimos 30 dias.
- **Ferramentas da academia** (rotas em `server/routes/{calendar,board,billing,classes}.ts`):
  - `class_occurrences` (aula + data): cancelamento ("feriado") com aviso a todos os membros, nota e
    **tema da aula**. O tema é gravado com a chamada e vai pré-preenchido no registro de treino dos
    presentes;
  - `academy_events` + `event_attendees`: eventos e campeonatos publicados pelo staff (todos os membros
    são notificados). O membro marca "vou" até `signup_until`; em campeonatos informa a categoria e,
    depois do início, o resultado (ele mesmo ou um professor). As medalhas do ano formam o quadro da
    academia. O **Smoothcomp não tem API pública**: o evento guarda só o link da prova;
  - **QR fixo da academia** (`academies.checkin_token`): um só QR, impresso na entrada
    (`/academia/:id/qr`, com versão de impressão que sai só o cartaz) ou mostrado na chamada. Ele leva a
    academia e o segredo, não a aula: ao ler, o servidor escolhe a aula que está a acontecer no fuso do
    celular (de 45 min antes do início até o fim; a mais próxima ganha), recusa aula cancelada e grava em
    `checkins`. O dono gera um QR novo se o impresso vazar. O check-in é um pedido: aparece na chamada e
    em "Chamadas por fazer" para o professor confirmar;
  - **o check-in já registra o treino**: o primeiro check-in na aula cria o treino com o tipo, a hora, a
    duração e o nome da aula (`source = checkin`), privado e sem intensidade, e ele já conta na semana,
    na sequência e na meta. Quando a aula acaba, a primeira vez que o aluno abre o app aparece "Como foi o
    treino?" (até 7 dias depois): **Preencher** abre o treino para completar (intensidade, rolas,
    técnicas, notas e visibilidade) e **Pular** deixa como está; os dois param de perguntar. Fechar o
    aviso só adia para a próxima abertura. Se o aluno já tinha registrado a aula, nada é criado, e
    "registrar o treino" a partir da presença confirmada edita o treino que já existe;
  - **check-in em um toque**: botão **Check-in** na barra de baixo (e na lateral, no desktop) e no cartão
    "Aula agora" do feed. Android: leitor de códigos do Google (`CameraView.launchScanner`), sem pedir
    permissão e fechando sozinho; web: câmara dentro do app (`/ler-qr`). Ao ler, o check-in acontece sem
    navegador nem novo login. O QR é uma URL web (`/checkin?a=&t=`), então a câmara do celular também
    serve;
  - `announcements`: mural só para membros; o staff publica e fixa avisos, e todos são notificados;
  - **Alunos sumidos**: alunos ativos há mais de 14 dias sem chamada, check-in nem treino registrado na
    academia (`GET /academies/:id/inactive`, só staff);
  - **Mensalidades**, só **registro** (o app não cobra): `membership_plans`, `academy_members.plan_id`,
    `payments` (valor, forma, mês de referência, meses cobertos). A situação é calculada (em dia, a vencer
    até `academies.billing_due_day`, em atraso, isento, sem plano). **Só o dono** vê e mexe
    (`canManageBilling`), não os professores. Cada aluno vê só a própria situação. Lembrete no app: no
    máximo um por dia. CSV do mês com `;` e vírgula decimal para o Excel em Portugal;
  - pagamentos, presenças, check-ins e inscrições em eventos entram na exportação de dados (RGPD).
- **Foto de perfil**: a pessoa enquadra a foto (arrastar e zoom) e o app reduz para 256×256 JPEG
  (~5–20 KB) antes de enviar; a API confere o tipo pelos primeiros bytes (JPEG/PNG/WebP, até 150 KB). Em
  produção os bytes ficam no **Vercel Blob privado** (`avatars/<user_id>`); sem credenciais do Blob (dev,
  testes) ficam na tabela `avatars` (base64), que também serve as fotos antigas até serem trocadas.
  `profiles.avatar_url` é um caminho versionado (`/api/avatars/:id?v=…`), servido pela API com cache
  "imutável". **Menores não podem ter foto** (`canHaveAvatar`). Fotos de treino continuam na fase 2.
- **Peso**: não é coletado. Não havia uso para ele no MVP, e o RGPD manda minimizar os dados.
- **Moderação**: `reports` agrupadas por alvo na fila `/admin/denuncias`; a decisão (sem violação,
  remover conteúdo, remover foto, suspender) avisa quem denunciou e quem foi afetado. Suspensão em
  `user.suspended_at` + `suspension_reason`: a pessoa sai de todos os aparelhos e não consegue entrar.
- **Textos**: mensagens de validação dos schemas zod são chaves de `validation` em `src/shared/i18n/`;
  app e API traduzem. Notificações guardam só o tipo, e o texto é montado no idioma de quem lê.
