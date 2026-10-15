# 04 — Custos, doações e roadmap

## Custos

Verificado em 10/2026:
- a regra de doações, na página oficial da Vercel;
- as cotas, em fontes secundárias. Confirmar as cotas nas páginas oficiais.

| Item | Custo | Observação |
|---|---|---|
| Vercel Hobby | US$ 0 | Uso não comercial. **Pedir doações é permitido** (Fair Use Guidelines). Cota: ~1 M invocações de função, 4 h de CPU ativa e 100 GB de transferência por mês. |
| Neon Free (via Marketplace) | US$ 0 | ~0,5 GB de banco e ~100 CU-horas/mês. Escala a zero. Treinos sem fotos ocupam poucos KB: 0,5 GB = milhões de treinos. |
| Better Auth | US$ 0 | Biblioteca, roda na própria API. |
| Resend Free | US$ 0 | Cota diária/mensal pequena, suficiente para links de login no início. |
| EAS Build Free | US$ 0 | ~15 builds Android/mês na nuvem. Também compila localmente no Linux, sem limite. |
| Google Play | **US$ 25, uma vez** | Conta de desenvolvedor. |
| Domínio | ~US$ 10–15/ano | Opcional: `*.vercel.app` funciona. |
| Cloudflare R2 (fase 2) | US$ 0 até 10 GB | Para fotos. |

**Total para lançar: US$ 25.**

O primeiro custo recorrente provável é o Neon Launch (por uso, a partir de ~US$ 5/mês), quando o
banco passar de 0,5 GB ou o uso de computação estourar a cota.

## Doações

- **Onde** (funcionam na Europa, em euros):
  - **Liberapay**: recorrente, sem taxa de plataforma (só a do processador), aceita SEPA e cartão.
  - **GitHub Sponsors**: recorrente ou única, sem taxa para contas pessoais; bom para quem já é dev.
  - **Ko-fi**: doação única por cartão, PayPal, Apple Pay ou Google Pay, sem o doador criar conta.
  - Para dar transparência às despesas, considerar depois o **Open Collective** (despesas públicas).
- **Onde aparece**: README, site e tela "Sobre".
- **Android**: no app da Play Store, **não colocar botão de doação**, só o link para o site. A política
  de pagamentos do Google restringe doações dentro do app a ONGs verificadas.
- **Transparência**: página `/apoie` com os custos mensais reais e quanto as doações cobrem.

## Licença

**AGPL-3.0.** Quem rodar uma versão modificada como serviço público precisa publicar o código. Isso
impede um fork fechado e pago do projeto.

## Roadmap

### Fase 0 — Fundação ✅ (código; falta criar as contas e fazer o deploy)
- Repositório público, licença AGPL e esqueleto Expo (web + Android).
- Hono em `api/`, Drizzle, Neon pelo Marketplace, Better Auth (link mágico + Google).
- Deploy na Vercel com preview por PR e branch de banco no Neon por preview.
- CI: lint, typecheck e testes com PGlite. Backup diário criptografado.

### Fase 1 — MVP (ver doc 01) ✅ no código, sem as fotos; beta pendente
- Treinos, diário, calendário e estatísticas.
- Academias básicas.
- Seguir, feed, Oss e comentários.
- Privacidade, regras para menores, denúncia, bloqueio e exclusão de conta.
- Página `/apoie`.
- Beta com 1 ou 2 academias: web + teste interno da Play Store.

### Fase 2 — Diferenciais de jiu-jitsu
- Timer de rounds que gera o treino.
- Rolls e finalizações, catálogo de técnicas, carga semanal e metas.
- Graduações confirmadas pelo professor, check-in por QR e grade de aulas.
- Push, fotos (R2) e imagem de compartilhamento (OG).

### Fase 3 — Ecossistema
- Health Connect; competições; desafios mensais.
- Ferramentas para professores: presença e alunos aptos a graduar.
- iOS: conta Apple US$ 99/ano, quando as doações cobrirem.
