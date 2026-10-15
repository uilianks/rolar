# 07 — Página da academia: próximas funcionalidades

> **Implementado (15/10/2026):** calendário com exceções e eventos, campeonatos (link + "vou competir" +
> resultados + quadro de medalhas), mensalidades (controlo manual), alunos sumidos, mural de avisos, tema
> da aula e check-in por QR. Detalhes em [03-dados](03-dados.md). O resto desta página continua como
> proposta: iCal, prontidão para graduar, aula experimental, seguro, painel do dono.

Objetivo: tirar o professor do caderno, do WhatsApp e da folha de Excel, sem custo para ele nem para o
projeto. Tudo abaixo reaproveita o que já existe: horários, chamada, graduações, membros e notificações.

Legenda de esforço: **P** = pequeno (1–2 dias), **M** = médio (3–5 dias), **G** = grande.

## 1. Agenda

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Calendário do mês** | Junta as aulas semanais, os eventos e as exceções numa vista de mês (desktop) ou de agenda (celular). Os alunos veem o mesmo calendário. | M |
| **Exceções** | Cancelar uma aula num dia ("feriado"), trocar o horário pontualmente ou pôr um substituto. Quem é aluno recebe aviso. O wireframe já previa "Sem aula no feriado". | P |
| **Eventos da academia** | Seminário, exame de graduação, open mat especial, confraternização. Têm data, hora, local e descrição; os alunos respondem "vou / não vou". | M |
| **Professor por aula** | Cada aula tem um instrutor; a chamada fica com o nome de quem deu a aula. | P |
| **Assinar no Google/Apple Calendar** | Link iCal (`.ics`) da academia: aulas, exceções e eventos aparecem no calendário do celular sem abrir o app. Grátis, e só uma rota na API. | P |

## 2. Campeonatos

**Smoothcomp não tem API pública.** Não há documentação para desenvolvedores; as únicas chaves de API do
site são as de pagamento dos organizadores. A IBJJF também não tem: publica as provas como páginas HTML.
Raspar o site do Smoothcomp é frágil (quebra quando o layout muda) e arriscado nos termos de uso.

Proposta em duas fases:

1. **Agora (M):** o professor (ou qualquer aluno, com aprovação do professor) cadastra o campeonato com
   nome, data, cidade e **link** para a página no Smoothcomp/IBJJF/AJP. Na página da academia:
   - "Próximos campeonatos";
   - alunos marcam **"vou competir"** com faixa, peso e categoria, para o professor saber quem preparar;
   - depois do evento, cada um regista o **resultado** (ouro, prata, bronze, participação). Aparece no perfil
     do atleta e num **quadro de medalhas da academia**.
2. **Depois:** pedir ao Smoothcomp acesso de parceiro (o projeto é open source e não comercial, o que
   ajuda). Com acesso, importar automaticamente os eventos de um país ou região e preencher o formulário
   acima a partir do link.

## 3. Mensalidades

O dono quer saber **quem pagou**, não precisa que o app cobre. Cobrar exigiria Stripe, taxas por
transação e obrigações de pagamento (PSD2). O projeto não teria custo, mas o dono teria, e o app passaria
a mexer em dinheiro. Por isso, primeiro só **controlo manual**:

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Planos** | Ex.: "Mensal adulto 45 €", "Kids 35 €", "Trimestral 120 €", "Bolsa". | P |
| **Estado por aluno** | Em dia, vence em breve ou **em atraso** (com quantos dias). Filtro "em atraso" na lista de membros. | M |
| **Marcar como pago** | Com forma de pagamento (dinheiro, MB Way, transferência), data e mês de referência. Fica num histórico. | P |
| **Lembrete ao aluno** | Notificação no app "a sua mensalidade de outubro está em aberto", enviada pelo dono com um toque. | P |
| **Exportar CSV** | Pagamentos do mês para a contabilidade. | P |

Privacidade: só o dono vê os pagamentos. Opcionalmente, o dono dá esse acesso a um "gestor". Cada aluno
vê apenas o próprio estado. Os pagamentos entram na exportação e na exclusão de dados do RGPD.

**Fase posterior (opcional):** link de pagamento do próprio dono (Stripe Payment Link, MB Way). O app só
mostra o link; o dinheiro vai direto do aluno para a conta do dono.

## 4. Graduação

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Prontidão para graduar** | Para cada aluno: tempo na faixa/grau atual e **presenças desde a última graduação** (a chamada já dá isso). O professor define critérios (ex.: 30 aulas e 4 meses por grau), e o app lista quem está **pronto ou quase**. | M |
| **Exame / cerimônia** | Evento de graduação no calendário; ao confirmar, as graduações de todos ficam registradas de uma vez. | P |
| **Histórico da academia** | Quem graduou quem e quando: a "linhagem" que hoje fica de cabeça. | P |

## 5. Alunos e retenção

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Alunos sumidos** | "Não vem há 14 dias": lista para o professor mandar uma mensagem antes de o aluno desistir. Usa as presenças. | P |
| **Aula experimental** | Página pública da academia com um botão "Marcar aula experimental". O pedido chega ao professor (nome, contacto, dia). É a porta de entrada de novos alunos. | M |
| **Mural de avisos** | Avisos fixados na academia ("traga o kimono azul", "sem aula sexta"), com notificação aos alunos. Tira o grupo do WhatsApp do caminho. | P |
| **Seguro e termo** | Em Portugal, o **seguro desportivo** é obrigatório. Guardar só a **data de validade** do seguro e se o termo de responsabilidade foi assinado, com alerta antes de vencer. Atestados médicos não: são dados de saúde (art. 9.º do RGPD). | P |
| **Responsáveis dos menores** | Contacto do pai, mãe ou responsável para os alunos kids, visível só ao staff. | P |

## 6. Aulas e conteúdo

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Tema da aula** | Na chamada, o professor anota o que ensinou ("raspagem de gancho + passagem toreando"). Vai para o registro de treino de quem estava presente, que não precisa digitar. | P |
| **Plano de semanas** | Currículo por ciclo (ex.: 4 semanas de guarda fechada). Os alunos veem o tema da semana. | M |
| **Check-in por QR** | QR na receção: o aluno lê com o celular e fica como "pedido de presença" para o professor confirmar, o mesmo fluxo de hoje. | M |

## 7. Números da academia (para o dono)

| Funcionalidade | O que faz | Esforço |
|---|---|---|
| **Painel** | Alunos ativos, novos e saídas no mês; presença média por aula. **Qual horário enche e qual está vazio**, para decidir abrir ou fechar turmas. | M |
| **Distribuição de faixas** | Quantos brancas, azuis, etc., e a evolução no tempo. | P |

## Fora de propósito (por agora)

- **Loja** de kimonos e patches: logística e pagamentos.
- **Reserva de vagas** em aulas: só faz sentido com lotação limitada; é rara em BJJ.
- **Folha de pagamento** de professores, contabilidade: há ferramentas próprias para isso.

## Ordem sugerida

1. ✅ **Calendário + exceções + mural de avisos.** Resolve o dia a dia e substitui o WhatsApp.
   ⏳ Falta o link iCal, que é barato.
2. ✅ **Mensalidades (controlo manual).** Era o pedido mais concreto, e o dono passa a abrir o app todos os
   meses.
3. ⏳ **Prontidão para graduar** + ✅ **alunos sumidos.** Aproveitam a chamada que já existe; quase não têm UI nova.
4. ✅ **Campeonatos (cadastro manual com link) + resultados + quadro de medalhas.**
5. ⏳ Aula experimental e página pública da academia, que é o crescimento do app.

Também ⏳: professor por aula, troca pontual de horário, plano de semanas, seguro e termo,
responsáveis dos menores, painel do dono.

Fontes da pesquisa sobre campeonatos (15/10/2026):
- [Smoothcomp Knowledge Base](https://support.smoothcomp.com/article/94-receive-payments-online): as chaves de API documentadas são só de pagamento.
- [IBJJF — European 2027 pre-schedule](https://ibjjf.com/events/european-ibjjf-jiu-jitsu-championship-2027/pre_schedule): eventos publicados como páginas HTML.
