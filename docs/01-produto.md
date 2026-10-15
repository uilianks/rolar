# 01 — Produto

## A troca central

No Strava a unidade é a **atividade com GPS**; o valor vem de mapas, segmentos e leaderboards. No
jiu-jitsu não há trajeto: a unidade é o **treino no tatame**, e o valor vem de **evolução técnica,
constância e comunidade da academia**. Isso elimina a parte mais cara de um app como o Strava (mapas,
heatmaps, processamento de GPS).

## Mapa Strava → jiu-jitsu

| Strava | Equivalente aqui | Fase |
|---|---|---|
| Atividade (tipo, duração, descrição, fotos) | **Treino**: modalidade (gi, no-gi, open mat, drill, competição, particular, dando aula), duração, nº de rounds, notas (fotos na fase 2) | MVP |
| Esforço percebido (slider Easy→Max, substitui FC) | **Mesmo slider (RPE 1–10)** — no BJJ quase ninguém usa cinta cardíaca, então RPE é o dado principal | MVP |
| Relative Effort / Fitness (pago) | **Carga semanal** = duração × RPE (método session-RPE de Foster), faixas baixa/ideal/alta como no Strava — **grátis** | 2 |
| Training log / calendário | **Diário de treinos** + calendário estilo GitHub (dias no tatame) | MVP |
| Feed, kudos, comentários | Feed, **"Oss"** no lugar de kudos, comentários | MVP |
| Seguir atletas, busca | Igual | MVP |
| Clubes (membros, eventos, discussão, leaderboard) | **Academias**: membros, professores, grade de horários, avisos, ranking de presença do mês | MVP (básico) / 2 |
| Eventos recorrentes de clube (`group_events/occurrences`) | **Aulas da grade** (recorrência semanal) | 2 |
| Waivers de evento | Termo de responsabilidade da academia / aula experimental | 3 |
| Segmentos + PRs + Local Legend | **Técnicas**: catálogo de posições/finalizações; "finalizações aplicadas/sofridas"; "Local Legend" = quem mais treinou na academia no mês | 2 |
| Rolls não existem | **Rolls** dentro do treino: parceiro (usuário ou texto), faixa do parceiro, resultado, finalização | 2 |
| Verificação de prova / resultados de prova | **Graduações** (faixa + graus) com histórico, **confirmadas pelo professor** | 2 |
| Resultados de competição | Campeonatos: evento, categoria, peso, colocação | 3 |
| Metas (pago) | Metas: treinos/semana, horas/mês — grátis | 2 |
| Desafios mensais | Desafios ("20 treinos em novembro") | 3 |
| Beacon (localização ao vivo) | Não faz sentido | — |
| Check-in por GPS | **Check-in por QR code** na academia (sem permissão de localização) | 2 |
| Integrações Garmin/Apple | HealthKit / Health Connect: importar treinos "Martial Arts" e FC | 3 |
| Upload de arquivo GPX/FIT | Não necessário | — |
| Timer de gravação | **Timer de rounds** (5 min/1 min) que **gera o treino automaticamente** — gancho de uso diário | 2 |
| Privacidade (zonas, visibilidade) | Visibilidade por treino (público/seguidores/só eu), esconder peso | MVP |
| Denúncias (9 tipos) + `report/[legislation]` | Denunciar e bloquear usuário/conteúdo — **obrigatório** para apps com conteúdo de usuário na App Store | MVP |
| Verificação de idade no onboarding | Idade mínima no cadastro (decisão em aberto) | MVP |
| 56 tipos de esporte | Não: só jiu-jitsu, com modalidades. Talvez judô/wrestling/MMA depois | — |

## O que **não** copiar

- **Paywall pesado.** O Strava tranca análises básicas (Relative Effort, metas). Aqui o núcleo é grátis.
- **Três frontends convivendo** (Rails + 2 Next + module federation): uma base de código só.
- **Telemetria em excesso** (Sentry + Snowplow + Branch + Amplitude): começar sem, adicionar só erro.
- **Fluxo de retenção no cancelamento** (`/account/dontgo`): sem dark patterns.

## Escopo do MVP

1. Cadastro/login (e-mail com link mágico + Google), idade mínima 13 anos.
2. Perfil: nome, avatar (do Google ou iniciais), faixa/graus, academia, peso (privado por padrão).
3. Registrar treino (formulário curto, < 15 s) e editar/apagar.
4. Diário + calendário + estatísticas: horas no tatame, treinos/semana, sequência, distribuição gi/no-gi.
5. Academias: criar, entrar (pedido aprovado pelo professor), lista de membros.
6. Social: seguir, feed (seguidos + academia), Oss, comentários.
7. Privacidade, denunciar, bloquear, apagar conta (exigido pelas lojas e pelo RGPD).

Critério de pronto: um aluno registra treinos por 4 semanas e vê a própria evolução; colegas da mesma
academia veem e reagem.
