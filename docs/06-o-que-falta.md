# 06 — O que falta (revisão do plano)

Revisão feita antes de começar o código e atualizada ao final da primeira rodada (15/10/2026).

## Precisa de você (contas, decisões, textos legais)

| Item | Por quê | Como |
|---|---|---|
| **Nome do app e domínio** | ✅ **rolar** / `rolar.app` (package Android `app.rolar`, esquema `rolar://`). Falta **comprar** o domínio | Cloudflare Registrar (~14 €/ano), renovação automática; depois ligar à Vercel |
| **E-mail de contacto** | Política e termos indicam `contato@rolar.app` | Cloudflare Email Routing (grátis) reencaminhando para o seu e-mail |
| **Resend + domínio verificado** | ✅ `mail.rolar.app` verificado (UE, DKIM/SPF/DMARC no DNS da Vercel); chave só de envio `rolar-producao` em `RESEND_API_KEY` | — |
| **Projeto Vercel + Neon** | ✅ No ar em https://rolar.app (Neon em Frankfurt; API em bundle ESM via Build Output API) | — |
| **Conta Expo (EAS) + Google Play** | APK/AAB e loja | `npx eas-cli build -p android`; conta Play (25 US$) |
| **Responsável e contacto na política de privacidade** | ✅ Preenchido (Uilian Kidricki, `contato@rolar.app`) | Confirmar o nome legal |
| **Termos de uso** | ✅ `/termos` (conduta, academias, moderação, doações, lei portuguesa) | Rever antes do lançamento |
| **Contas de doação** | ✅ GitHub Sponsors (`uilianks`) e Ko-fi (`uiliankidricki`) no `.env.local` e em `.github/FUNDING.yml` | Na Vercel: copiar `EXPO_PUBLIC_DONATE_GITHUB` e `EXPO_PUBLIC_DONATE_KOFI`; `EXPO_PUBLIC_DONATE_PAGE` depois do domínio. Liberapay ficou de fora (botão escondido) |
| **Login com Google** (opcional) | Menos atrito | Cliente OAuth no Google Cloud; `GOOGLE_CLIENT_*`, `EXPO_PUBLIC_GOOGLE_LOGIN=1` |
| **Repositório no GitHub** | CI, backup, contribuições | Criar e dar push. O commit está pendente porque falta configurar `git user.name`/`user.email` |

## Lacunas encontradas na revisão

| Lacuna | Risco | Situação |
|---|---|---|
| **RGPD** (o plano falava em LGPD; você está na UE) | Multa, remoção da loja | ✅ exportar dados, ✅ apagar conta, ✅ política (rascunho), ⏳ região UE no Neon, ⏳ registro de tratamento |
| **Idade de consentimento** varia na UE (13–16) | Em alguns países, menores de 16 precisam de autorização dos pais | Base legal usada é **contrato**, não consentimento, e o app não tem perfilagem nem anúncios. Rever se surgirem funções baseadas em consentimento |
| **DSA** (moderação) | Plataformas precisam de canal de denúncia e ponto de contacto | ✅ denúncia de usuário/treino. ✅ painel `/admin` (por enquanto só verifica academias). ⏳ revisar `reports` no painel (hoje é só SQL) |
| **Academias falsas** | Alguém se passar pela academia de outra pessoa | ✅ cadastro com contactos oficiais + aprovação por admin. ⏳ upload de documento (precisa de armazenamento, fase 2); ⏳ editar academia aprovada (hoje só pelo suporte) |
| **Rate limit** | O spam de códigos por e-mail gasta a cota da Resend | ✅ No banco (tabela `rate_limit`, vale para todas as instâncias da Vercel). Envio de código: 30 por 10 min por IP (uma turma no Wi-Fi da academia); testado |
| **Fuso horário** | Estatísticas erradas perto da meia-noite | ✅ calculadas no fuso do aparelho |
| **Check-in no app Android** | `expo-camera` tem código nativo: precisa de um build do app (EAS), não roda no Expo Go | Verificado só na web (câmara simulada lendo o QR em 0,8 s). Com domínio próprio, configurar App Links para o QR lido pela câmara do sistema abrir direto no app |
| **QR fixo fotografado** | Alguém pode fotografar o QR da entrada e fazer check-in de casa | O check-in é só um pedido que o professor confirma, e o dono pode gerar um QR novo. Se virar problema: QR rotativo num tablet na receção |
| **Offline** | Academia sem sinal | ⏳ O app precisa de rede para salvar. Fila offline do registro de treino na fase 2 |
| **Acessibilidade** | Leitores de tela | Rótulos nos botões de ícone e nos controles. ⏳ Revisar contraste e foco no web |
| **Observabilidade** | Erros em produção passam despercebidos | Só `console.error` (logs da Vercel). ⏳ Sentry (plano grátis) se fizer falta |
| **Bundle web 2,1 MB** | Primeiro carregamento lento em 4G | Aceitável no MVP. ⏳ Dividir rotas / landing estática |
| **Landing para visitantes** | Na web, quem não está logado cai direto no login | ⏳ Publicar `design/landing.html` como página estática ou como rota pública |
| **i18n** | Público PT-PT, PT-BR e EN | Textos em PT-BR fixos no código. ⏳ Extrair para um dicionário antes de traduzir |
| **Moderação de fotos** | — | Fotos ainda não existem (fase 2) |

## Próximos passos sugeridos

1. Commit e push para o GitHub, com a sua identidade no git.
2. Vercel + Neon (UE) + Resend com domínio. Primeiro deploy; testar login de verdade.
3. Build Android de teste (EAS) e teste interno da Play Store.
4. Denúncias no painel `/admin`.
5. Fase 2: push, timer com tela sempre acesa/vibração, rolas detalhados, catálogo de técnicas,
   grade de aulas e check-in por QR.
