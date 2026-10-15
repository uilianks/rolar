# design/ — wireframes em HTML puro

Layout de todas as telas antes do código do app. HTML + CSS + um pouco de JS (sem framework, sem build).

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory design   # abrir http://127.0.0.1:8765/
```

`index.html` mostra todas as telas em moldura de celular; cada tela abre sozinha e vira layout de
desktop (sidebar) acima de 900 px. Tema claro/escuro segue o sistema, com botão para alternar.

| Arquivo | Papel |
|---|---|
| `styles.css` | Tokens (cores, raio, faixas, heatmap) e componentes; base para o tema do app Expo |
| `app.js` | Monta sidebar + dock, tema, heatmap, Oss, steppers, slider de intensidade |
| `landing` `entrar` `onboarding` | Visitante, login (link mágico + Google), cadastro em 4 passos |
| `feed` `registrar` `timer` `treino` | Núcleo: feed, registrar treino, timer de rounds, detalhe |
| `progresso` `perfil` `academia` | Estatísticas/diário, perfil com graduações, academia (grade, ranking, painel do professor) |
| `notificacoes` `config` `apoie` | Notificações + estado vazio + toast, configurações/privacidade, doações |

## Referência visual

[21st.dev](https://21st.dev/community/components): linguagem shadcn (neutros zinc, bordas 1 px, raio
12 px, primário preto/branco), com o vermelho como único acento (faixa preta / ponta vermelha).
Categorias usadas como referência por tela estão listadas no `index.html` (Heroes, Bento, Stats &
KPIs, Calendars, Charts, Docks, Sidebars, Sign In, Onboarding, Steppers, Countdown/Stopwatch,
Timelines, Empty States, Toasts, Pricing, FAQ…).

## Componentes próprios do domínio

- **Faixa** (`.belt` + `.tip` com `<i>` por grau): branca, azul, roxa, marrom, preta (ponta vermelha).
- **Calendário de treinos** (`[data-heatmap]`): estilo contribuições do GitHub.
- **Carga semanal**: barras com a semana atual em destaque + faixa "ideal".

Ícones: Lucide via unpkg (`lucide@0.469.0`) — sem internet, os ícones somem mas o layout não quebra.
