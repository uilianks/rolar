# 03 — Modelo de dados (rascunho)

Postgres no Neon, esquema em Drizzle (`api/db/schema.ts`). As tabelas de login (`user`, `session`,
`account`, `verification`) são do Better Auth; `profiles` estende `user` 1:1.

```
profiles        user_id · username · name · avatar_url · birth_year
                belt (white|blue|purple|brown|black|coral|red + faixas kids) · stripes 0–4
                weight_kg (privado) · home_academy_id · is_minor (derivado de birth_year)

academies       id · name · slug · city · country · lat/lng (opcional) · created_by
academy_members academy_id · user_id · role (owner|coach|student) · status (pending|active) · joined_at

sessions        id · user_id · academy_id? · started_at · duration_min
(treinos)       kind (gi|nogi|open_mat|drill|competition|private|teaching) · rounds · rpe 1–10
                notes · visibility (public|followers|private) · source (manual|timer|health)

rolls (fase 2)  session_id · partner_user_id? · partner_name? · partner_belt
                outcome (sub_win|sub_loss|points|draw|flow) · technique_id?
techniques      id · name · category (submission|sweep|pass|takedown|escape|position) · parent_id
session_techniques  session_id · technique_id
session_media (fase 2)  session_id · object_key · width · height

promotions      user_id · belt · stripes · promoted_at · academy_id · confirmed_by (coach)?

follows         follower_id · followee_id · created_at
reactions       session_id · user_id   ("Oss")
comments        id · session_id · user_id · body · created_at
blocks          blocker_id · blocked_id
reports         id · reporter_id · target_type · target_id · reason · status
push_tokens     user_id · token · platform
feature_flags   key · enabled_for (all | lista de user_id)
```

## Regras de acesso (módulo `api/policies.ts`, uma função por recurso)

- **Treinos**: o dono lê e escreve. Os outros só leem se:
  - o treino for `public`, ou
  - for `followers` e eles seguirem o dono.
  Em qualquer caso, ninguém lê se houver bloqueio em qualquer direção.
- **Perfil**: `weight_kg` e `birth_year` só aparecem para o dono. Para isso existe um serializer
  público separado, sem esses campos.
- **Academia**:
  - o aluno cria um pedido `pending`;
  - só `owner|coach` ativo aprova ou muda o papel de alguém.
- **Graduação**: só `coach|owner` ativo da academia preenche `confirmed_by`.
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
  - `notifications`: Oss, comentário, seguidor, pedido ou aprovação na academia, pedido ou
    confirmação de graduação;
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
- **Peso**: não é coletado. Não havia uso para ele no MVP, e o RGPD manda minimizar os dados.
