# 06 — O que falta (revisão do plano)

Revisão feita antes de começar o código; última atualização em 15/10/2026, depois do deploy e da tradução.

## Precisa de você (contas, decisões, textos legais)

| Item | Por quê | Como |
|---|---|---|
| **Nome do app e domínio** | ✅ **rolar** / `rolar.app` (package Android `app.rolar`, esquema `rolar://`), DNS na Vercel | Confirmar a renovação automática do domínio |
| **E-mail de contacto** | ✅ `contato@rolar.app` reencaminhado pelo ImprovMX (plano grátis; MX e SPF no DNS da Vercel) para o Gmail | — |
| **Resend + domínio verificado** | ✅ `mail.rolar.app` verificado (UE, DKIM/SPF/DMARC no DNS da Vercel); chave só de envio `rolar-producao` em `RESEND_API_KEY` | — |
| **Projeto Vercel + Neon** | ✅ No ar em https://rolar.app (Neon em Frankfurt; API em bundle ESM via Build Output API) | — |
| **Conta Expo (EAS) + Google Play** | APK/AAB e loja. Ainda não há `eas.json` | `npx eas-cli build -p android`; conta Play (25 US$) |
| **Responsável e contacto na política de privacidade** | ✅ Preenchido (Uilian Kidricki, `contato@rolar.app`) | Confirmar o nome legal |
| **Termos de uso** | ✅ `/termos` (conduta, academias, moderação, doações, lei portuguesa) | Rever antes do lançamento |
| **Contas de doação** | ✅ GitHub Sponsors (`uilianks`) e Ko-fi (`uiliankidricki`) no `.env.local` e em `.github/FUNDING.yml` | Na Vercel: copiar `EXPO_PUBLIC_DONATE_GITHUB` e `EXPO_PUBLIC_DONATE_KOFI`; `EXPO_PUBLIC_DONATE_PAGE` depois do domínio. Liberapay ficou de fora (botão escondido) |
| **Login com Google** (opcional) | Menos atrito | Cliente OAuth no Google Cloud; `GOOGLE_CLIENT_*`, `EXPO_PUBLIC_GOOGLE_LOGIN=1` |
| **Repositório no GitHub** | ✅ [uilianks/rolar](https://github.com/uilianks/rolar), CI verde em cada push | — |
| **Backup do banco** | O Neon grátis guarda poucas horas de histórico | Workflow pronto e desligado: gerar par de chaves `age`, pôr os segredos do banco e da chave pública no GitHub e a variável `BACKUP_ENABLED=true` ([02](02-arquitetura.md#backup)) |

## Lacunas encontradas na revisão

| Lacuna | Risco | Situação |
|---|---|---|
| **RGPD** (o plano falava em LGPD; você está na UE) | Multa, remoção da loja | ✅ exportar dados, ✅ apagar conta, ✅ política (pt e en), ✅ Neon em Frankfurt, ⏳ registro de tratamento |
| **Idade de consentimento** varia na UE (13–16) | Em alguns países, menores de 16 precisam de autorização dos pais | Base legal usada é **contrato**, não consentimento, e o app não tem perfilagem nem anúncios. Rever se surgirem funções baseadas em consentimento |
| **DSA** (moderação) | Plataformas precisam de canal de denúncia e ponto de contacto | ✅ denúncia de usuário/treino. ✅ fila de denúncias em `/admin/denuncias` (dispensar, remover conteúdo, remover foto, suspender), com aviso a quem denunciou e a quem teve conteúdo removido. ⏳ a notificação ao afetado não traz o motivo (só aponta para os termos) |
| **Academias falsas** | Alguém se passar pela academia de outra pessoa | ✅ cadastro com contactos oficiais + aprovação por admin. ⏳ upload de documento (precisa de armazenamento, fase 2); ✅ admin edita os dados e transfere o responsável |
| **Rate limit** | O spam de códigos por e-mail gasta a cota da Resend | ✅ No banco (tabela `rate_limit`, vale para todas as instâncias da Vercel). Envio de código: 30 por 10 min por IP (uma turma no Wi-Fi da academia); testado |
| **Fuso horário** | Estatísticas erradas perto da meia-noite | ✅ calculadas no fuso do aparelho |
| **Check-in e idioma no app Android** | `expo-camera` e `expo-localization` têm código nativo: precisam de um build do app (EAS), não rodam no Expo Go | Verificado só na web (câmara simulada lendo o QR em 0,8 s). Com domínio próprio, configurar App Links para o QR lido pela câmara do sistema abrir direto no app |
| **QR fixo fotografado** | Alguém pode fotografar o QR da entrada e fazer check-in de casa | O check-in é só um pedido que o professor confirma, e o dono pode gerar um QR novo. Se virar problema: QR rotativo num tablet na receção |
| **Offline** | Academia sem sinal | ⏳ O app precisa de rede para salvar. Fila offline do registro de treino na fase 2 |
| **Acessibilidade** | Leitores de tela | Rótulos nos botões de ícone e nos controles. ⏳ Revisar contraste e foco no web |
| **Observabilidade** | Erros em produção passam despercebidos | Só `console.error` (logs da Vercel). ⏳ Sentry (plano grátis) se fizer falta |
| **Bundle web 2,1 MB** | Primeiro carregamento lento em 4G | Aceitável no MVP. ⏳ Dividir rotas / landing estática |
| **Landing para visitantes** | Na web, quem não está logado cai direto no login | ⏳ Publicar `design/landing.html` como página estática ou como rota pública |
| **i18n** | Público PT-PT, PT-BR e EN | ✅ Textos em `src/shared/i18n/`, app e API em português e inglês. ⏳ O português mistura PT-BR e PT-PT; uniformizar. ⏳ `manifest.json` e descrição do `app.json` só em português. ⏳ Revisão jurídica da versão inglesa dos termos e da política |
| **Moderação de fotos** | Foto de perfil imprópria | ✅ admin remove a foto (pela denúncia do perfil ou na página da conta). Fotos de treino ainda não existem (fase 2) |

## Próximos passos sugeridos

1. ~~Commit e push para o GitHub.~~ Feito.
2. ~~Vercel + Neon (UE) + Resend com domínio; primeiro deploy.~~ Feito: https://rolar.app.
3. Ligar o backup diário do banco.
4. Build Android (EAS) e teste interno da Play Store.
5. ~~Denúncias no painel `/admin`.~~ Feito. ~~Tradução para inglês.~~ Feito.
6. Beta com 1 ou 2 academias.
7. Fase 2 que falta: push, rolas detalhados, catálogo de técnicas, fotos de treino, imagem de
   compartilhamento, landing pública.
