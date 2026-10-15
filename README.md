# rolar — diário de treino de jiu-jitsu

App open source para registrar treinos de jiu-jitsu, acompanhar a evolução e se conectar com a
academia.

- **Plataformas**: web + Android, a partir de **uma base de código** (Expo). iOS fica para depois.
- **Infraestrutura**: Vercel (Hobby) + Neon Postgres.
- **Mantido por doações**, com licença **AGPL-3.0**.

Status: **MVP implementado** (15/10/2026); ainda sem deploy. Inspirado no Strava, adaptado ao tatame. Site: [rolar.app](https://rolar.app).

```bash
npm install && cp .env.example .env.local
npm run dev:api     # API + banco local (PGlite); o código de login aparece aqui
# ou, com Postgres de verdade no Docker: npm run db:up && npm run dev:api:pg
npm run web         # http://localhost:8081
npm test            # API, regras de acesso e estatísticas
```

## Documentos

| Doc | Conteúdo |
|---|---|
| [01-produto](docs/01-produto.md) | Strava → jiu-jitsu: o que copiar, adaptar e evitar; escopo do MVP |
| [02-arquitetura](docs/02-arquitetura.md) | Expo + Hono (Vercel Functions) + Drizzle + Neon + Better Auth |
| [03-dados](docs/03-dados.md) | Modelo de dados, regras de acesso, regras para menores |
| [04-custos-e-roadmap](docs/04-custos-e-roadmap.md) | Custos (US$ 25 para lançar), doações, licença, fases |
| [05-desenvolvimento](docs/05-desenvolvimento.md) | Como rodar, estrutura do código, decisões de implementação, o que foi verificado |
| [06-o-que-falta](docs/06-o-que-falta.md) | O que precisa de você (contas, textos legais) e lacunas encontradas na revisão |
| [07-academia-ideias](docs/07-academia-ideias.md) | Próximas funcionalidades da academia: calendário, campeonatos, mensalidades, graduação, retenção |
| [design/](design/README.md) | Wireframes em HTML puro de todas as telas (abrir `design/index.html`) |

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Monetização | Só doações. A Vercel permite doações no plano Hobby. |
| Licença | AGPL-3.0 |
| Plataformas | Web + Android. iOS na fase 3. |
| Banco | Neon via Vercel Marketplace |
| Idade mínima | 13+, autodeclarada. Menores de 18 ficam com perfil privado e fora da busca. |

## Em aberto

- Nome do app.
