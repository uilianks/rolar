# 01 — Produto

## A troca central

No Strava a unidade é a **atividade com GPS**; o valor vem de mapas, segmentos e leaderboards. No
jiu-jitsu não há trajeto: a unidade é o **treino no tatame**, e o valor vem de **evolução técnica,
constância e comunidade da academia**. Isso elimina a parte mais cara de um app como o Strava (mapas,
heatmaps, processamento de GPS).

## Mapa Strava → jiu-jitsu

✅ = já existe no app (situação em 15/10/2026). Os outros ficam para a fase indicada.

| Strava | Equivalente aqui | Fase |
|---|---|---|
| Atividade (tipo, duração, descrição, fotos) | **Treino**: modalidade (gi, no-gi, open mat, drill, competição, particular, dando aula), duração, nº de rounds, técnicas, notas | ✅ (fotos na fase 2) |
| Esforço percebido (slider Easy→Max, substitui FC) | **Mesmo slider (RPE 1–10)** — no BJJ quase ninguém usa cinta cardíaca, então RPE é o dado principal | ✅ |
| Relative Effort / Fitness (pago) | **Carga semanal** = duração × RPE (método session-RPE de Foster), faixas baixa/ideal/alta como no Strava — **grátis** | ✅ |
| Training log / calendário | **Diário de treinos** + calendário estilo GitHub (dias no tatame) | ✅ |
| Feed, kudos, comentários | Feed, **"Oss"** no lugar de kudos, comentários | ✅ |
| Seguir atletas, busca | Igual | ✅ |
| Clubes (membros, eventos, discussão, leaderboard) | **Academias**: membros, professores, horários, mural de avisos, ranking de presença do mês, eventos | ✅ |
| Eventos recorrentes de clube (`group_events/occurrences`) | **Aulas da grade** (recorrência semanal), com cancelamentos e chamada | ✅ |
| Waivers de evento | Termo de responsabilidade da academia / aula experimental | 3 |
| Segmentos + PRs + Local Legend | **Técnicas**: hoje lista livre no treino; catálogo de posições/finalizações e "finalizações aplicadas/sofridas" na fase 2. "Local Legend" = mais presentes do mês na academia (✅) | 2 |
| Rolls não existem | **Rolls** dentro do treino: parceiro (usuário ou texto), faixa do parceiro, resultado, finalização | 2 |
| Verificação de prova / resultados de prova | **Graduações** (faixa + graus, incluindo faixas infantis) com histórico, **confirmadas pelo professor** | ✅ |
| Resultados de competição | **Campeonatos da academia**: link da prova, "vou competir", categoria, resultado, quadro de medalhas | ✅ |
| Metas (pago) | Meta de treinos por semana — grátis | ✅ (horas/mês depois) |
| Desafios mensais | Desafios ("20 treinos em novembro") | 3 |
| Beacon (localização ao vivo) | Não faz sentido | — |
| Check-in por GPS | **Check-in por QR code** na academia (sem permissão de localização) | ✅ |
| Integrações Garmin/Apple | HealthKit / Health Connect: importar treinos "Martial Arts" e FC | 3 |
| Upload de arquivo GPX/FIT | Não necessário | — |
| Timer de gravação | **Timer de rounds** (5 min/1 min) que **gera o treino automaticamente** — gancho de uso diário | ✅ |
| Privacidade (zonas, visibilidade) | Visibilidade por treino (público/seguidores/só eu), mudar a de treinos passados | ✅ |
| Denúncias (9 tipos) + `report/[legislation]` | Denunciar e bloquear usuário/conteúdo, fila de moderação no admin — **obrigatório** para apps com conteúdo de usuário | ✅ |
| Verificação de idade no onboarding | Idade mínima de 13 anos, autodeclarada no cadastro | ✅ |
| 56 tipos de esporte | Não: só jiu-jitsu, com modalidades. Talvez judô/wrestling/MMA depois | — |

## O que **não** copiar

- **Paywall pesado.** O Strava tranca análises básicas (Relative Effort, metas). Aqui o núcleo é grátis.
- **Três frontends convivendo** (Rails + 2 Next + module federation): uma base de código só.
- **Telemetria em excesso** (Sentry + Snowplow + Branch + Amplitude): começar sem, adicionar só erro.
- **Fluxo de retenção no cancelamento** (`/account/dontgo`): sem dark patterns.

## Escopo do MVP (✅ entregue)

1. Cadastro/login (código de 6 dígitos por e-mail + Google opcional), idade mínima 13 anos.
2. Perfil: nome, foto (recortada no app; menores ficam com as iniciais), faixa/graus, academia. Peso
   não é coletado (minimização do RGPD).
3. Registrar treino (formulário curto, < 15 s) e editar/apagar.
4. Diário + calendário + estatísticas: horas no tatame, treinos/semana, sequência, distribuição gi/no-gi.
5. Academias: cadastrar (com verificação por admin), entrar (pedido aprovado pelo professor), lista de membros.
6. Social: seguir, feed (seguidos + academia), Oss, comentários.
7. Privacidade, denunciar, bloquear, exportar dados, apagar conta (exigido pelas lojas e pelo RGPD).

Critério de pronto: um aluno registra treinos por 4 semanas e vê a própria evolução; colegas da mesma
academia veem e reagem.
