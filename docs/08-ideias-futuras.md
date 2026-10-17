# 08 — Ideias para o futuro

Ideias discutidas em 17/10/2026 e guardadas para depois. Nada aqui está implementado. Antes de começar
qualquer uma, rever o desenho com o dono do projeto.

## Rolas com parceiros

O diferencial que mais aproveita a rede da academia: um diário individual não sabe quem são os colegas,
o Rolar sabe.

- Ao registrar um treino, anotar **com quem rolou**: colegas da academia (lista dos membros ativos) ou
  um nome livre para quem não usa o app. Por rola: resultado (finalizei, fui finalizado, empate, só
  flow) e a finalização.
- **Perfil:** parceiros mais frequentes e o retrospecto contra cada um ("Você e o João: 14 rolas,
  5 × 3, ele te pega no triângulo").
- **Professor:** quem rola com quem na turma, e quem está sempre isolado.
- **Privacidade:** o parceiro vê que foi citado e pode se remover. Menores só aparecem para colegas da
  mesma academia (regras atuais de `server/policies.ts`). O retrospecto só conta rolas que o parceiro
  não removeu.
- Dados: a tabela `rolls` já estava prevista em [03-dados](03-dados.md) (`session_id · partner_user_id?
  · partner_name? · partner_belt`, mais `outcome` e `technique`).

## Notificações push

O plano completo (Web Push com chaves VAPID, sem conta em nenhum serviço) está em
[06 — Plano: notificações push](06-o-que-falta.md#plano-notificações-push). O que entraria com ele:

- lembrete de treino ("Faltam 2 treinos para a meta"), com horário escolhido pelo atleta;
- "Como foi o treino?" logo depois da aula do check-in;
- avisos do mural, comentários e Oss em tempo real;
- "Conquista desbloqueada" fora do app (hoje o pop-up só aparece com o app aberto).

No app Android, o passo seguinte é `expo-notifications` com FCM (precisa de projeto Firebase e build EAS).

## Funcionar sem internet

Muita academia fica em porão ou garagem, sem sinal. Hoje o app precisa de rede para salvar.

- Fila local do registro de treino: o treino fica guardado no celular e é enviado quando a rede volta,
  com um aviso discreto de "pendente".
- Cuidado com duplicados: cada treino leva um id gerado no aparelho, e a API ignora o mesmo id duas vezes.
- O resto do app (feed, academia) pode continuar a pedir rede.

## Inteligência artificial

Adiada por custo: é a única parte que gasta dinheiro a cada uso, e o app é grátis. Se as doações
cobrirem, começar pelas duas primeiras.

| Funcionalidade | O que faz | Custo |
|---|---|---|
| **Resumo escrito da semana** | Um parágrafo em `/semana` ("Semana forte de no-gi; você bateu 3 vezes no triângulo") | O mais barato: 1 chamada por pessoa por semana, guardada; pode ir pela API de lote (metade do preço) |
| **Registro por voz** | Fala "gi, 90 minutos, 6 rolas, 2 armlocks, bati num triângulo" e o formulário se preenche | Transcrição no próprio celular (grátis); a IA só converte o texto nos campos |
| **"O que estudar"** | Sugestões a partir de onde a pessoa mais bate e das notas das técnicas | Barato, sob pedido |
| **Coach por chat** | Conversa livre com o histórico de treinos como contexto | O mais caro; exige limite diário por pessoa |
| **Plano de aula** | Sugere uma sequência de aulas a partir do catálogo da academia | Barato, pouco uso |

Estimativas de 17/10/2026, para cerca de 3 mil tokens de contexto por chamada:

| Por pessoa, por mês | Claude Opus 5.5 (US$ 4 / 20 por milhão de tokens) | Claude Haiku 5.5 (US$ 0,10 / 0,50) |
|---|---|---|
| Resumo semanal (4×) | ~US$ 0,07 | ~US$ 0,002 |
| Voz (20 treinos) | ~US$ 0,30 | ~US$ 0,01 |
| Chat (100 mensagens) | ~US$ 1,80 | ~US$ 0,05 |

Antes de começar:

- conta na API da Anthropic e `ANTHROPIC_API_KEY` só no servidor (Vercel), nunca no app;
- **RGPD:** a IA é opcional ("Ativar IA" nas configurações), e a política de privacidade passa a citar
  a Anthropic como processadora;
- desligada para menores de 18;
- limite de uso por pessoa (reaproveitar a tabela `rate_limit`).

## Consideradas e deixadas de fora

Avaliadas em 17/10/2026 e recusadas por agora:

| Ideia | Por quê |
|---|---|
| Sistemas / game plans (sequências de técnicas em lista) | O mapa de técnicas já cumpre esse papel. Se fizer falta, melhor permitir ligações pessoais no próprio mapa |
| Vídeos nas técnicas (no catálogo e nas notas) | Fora do escopo; as notas ficam só em texto |
| Checklist de técnicas por faixa | Não é prioridade |
| Mural aberto da comunidade | Exigiria moderação constante de conteúdo público entre estranhos |
| Importar treinos por CSV | Não é prioridade |
| Listas de seguidores e seguindo | Não é prioridade |
| Fotos nos treinos | Não é prioridade (custo de armazenamento e moderação) |
