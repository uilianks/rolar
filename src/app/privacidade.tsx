// Public (no login): linked from the login screen and settings; required by the GDPR and the Play Store listing.
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/shared/i18n";
import { LegalPage } from "@/ui/legal-page";

const CONTACT = "contato@rolar.app";

const PT: [string, string][] = [
  [
    "Quem somos",
    `O rolar (rolar.app) é um projeto open source (AGPL-3.0), sem fins lucrativos, financiado por doações. Responsável pelo tratamento dos dados: Uilian Kidricki, contacto ${CONTACT}.`,
  ],
  [
    "Que dados guardamos",
    "E-mail (para entrar), nome, nome de usuário, foto de perfil (se você enviar uma; menores não podem), ano de nascimento, faixa e graus, academias, treinos que você registra (data, duração, modalidade, rolas, intensidade, notas, técnicas), presenças e check-ins, inscrições em eventos e resultados, seguidores, Oss, comentários, graduações e denúncias que você faz. Se você cadastrar uma academia: os contactos oficiais dela (morada, telefone, e-mail, site, Instagram), o seu papel e a explicação que você der, usados só para verificar o cadastro. O responsável de uma academia pode registrar os pagamentos de mensalidade dos seus alunos; o app não cobra nem processa pagamentos. Não guardamos senha, localização nem dados de saúde.",
  ],
  [
    "Para que usamos",
    "Só para o funcionamento do app: mostrar o seu histórico e estatísticas, a sua academia e o feed das pessoas que você segue. Base legal: execução do contrato, isto é, dos termos de uso (art. 6.º, n.º 1, al. b) do RGPD). Os registos de mensalidade são feitos pela academia, para a gestão dela. Não vendemos dados, não mostramos anúncios e não usamos rastreadores de terceiros.",
  ],
  [
    "Quem vê",
    "Cada treino tem a visibilidade que você escolhe: todos, seguidores ou só você. Nome, nome de usuário, faixa e foto de perfil são públicos. O ano de nascimento nunca é público. Pagamentos de mensalidade só são vistos pelo responsável da academia e por você. Menores de 18 anos não têm foto, não aparecem na busca, não publicam treinos para todos e só podem ser seguidos por membros da mesma academia.",
  ],
  [
    "Onde ficam",
    "Banco de dados Neon (Postgres) e hospedagem Vercel. O e-mail de login é enviado pela Resend. Se você entrar com o Google, o Google confirma o seu e-mail e nome. Pedimos a região da União Europeia sempre que o fornecedor permite; quando não permite, a transferência segue as cláusulas contratuais-tipo da Comissão Europeia.",
  ],
  [
    "Seus direitos",
    `Em Configurações você pode baixar todos os seus dados (portabilidade) e apagar a conta com tudo o que ela contém (apagamento). Para acesso, retificação, oposição ou dúvidas, escreva para ${CONTACT}; respondemos em até 30 dias. Você pode reclamar à CNPD (cnpd.pt) ou à autoridade de proteção de dados do seu país.`,
  ],
  ["Idade mínima", "É preciso ter 13 anos ou mais para criar conta."],
  [
    "Retenção",
    "Os dados ficam enquanto a conta existir. Ao apagar a conta, tudo é removido do banco imediatamente; cópias de segurança cifradas expiram em até 30 dias.",
  ],
  ["Alterações", "Se esta política mudar de forma relevante, avisamos no app antes de a mudança valer."],
];

const EN: [string, string][] = [
  [
    "Who we are",
    `rolar (rolar.app) is a non-profit open source project (AGPL-3.0), funded by donations. Data controller: Uilian Kidricki, contact ${CONTACT}. This is a translation; if it differs from the Portuguese version, the Portuguese version prevails.`,
  ],
  [
    "What data we keep",
    "E-mail (to sign in), name, username, profile photo (if you upload one; minors cannot), year of birth, belt and stripes, academies, the sessions you log (date, duration, type, rounds, intensity, notes, techniques), attendance and check-ins, event sign-ups and results, followers, Oss, comments, promotions and the reports you make. If you register an academy: its official contact details (address, phone, e-mail, website, Instagram), your role and the explanation you give, used only to verify the registration. The person in charge of an academy can record their students' membership payments; the app does not charge or process payments. We do not keep passwords, location or health data.",
  ],
  [
    "What we use it for",
    "Only to run the app: showing your history and statistics, your academy and the feed of the people you follow. Legal basis: performance of a contract, that is, the terms of use (Art. 6(1)(b) GDPR). Membership payment records are kept by the academy, for its own management. We do not sell data, show ads or use third-party trackers.",
  ],
  [
    "Who sees it",
    "Each session has the visibility you choose: everyone, followers or only you. Name, username, belt and profile photo are public. Your year of birth is never public. Membership payments are seen only by the person in charge of the academy and by you. Under-18s have no photo, do not appear in search, cannot publish sessions to everyone and can only be followed by members of the same academy.",
  ],
  [
    "Where it is kept",
    "Neon database (Postgres) and Vercel hosting. The login e-mail is sent by Resend. If you sign in with Google, Google confirms your e-mail and name. We choose the European Union region whenever the provider allows it; when it does not, the transfer follows the European Commission's standard contractual clauses.",
  ],
  [
    "Your rights",
    `In Settings you can download all your data (portability) and delete your account with everything in it (erasure). For access, rectification, objection or questions, write to ${CONTACT}; we reply within 30 days. You can complain to the CNPD (cnpd.pt) or to the data protection authority of your country.`,
  ],
  ["Minimum age", "You must be 13 or older to create an account."],
  [
    "Retention",
    "Data is kept while the account exists. When you delete the account, everything is removed from the database immediately; encrypted backups expire within 30 days.",
  ],
  ["Changes", "If this policy changes in a meaningful way, we will tell you in the app before the change takes effect."],
];

const SECTIONS: Record<Locale, [string, string][]> = { pt: PT, en: EN };

export default function Privacy() {
  const { t, locale } = useLocale();
  return <LegalPage title={t.legal.privacyTitle} version={t.legal.version} sections={SECTIONS[locale]} />;
}
