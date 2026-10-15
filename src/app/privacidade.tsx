// Public (no login): linked from the login screen and settings; required by the GDPR and the Play Store listing.
import { LegalPage } from "@/ui/legal-page";

const CONTACT = "contato@rolar.app";

const SECTIONS: [string, string][] = [
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

export default function Privacy() {
  return <LegalPage title="Política de privacidade" version="Versão 1.0 · 15 de outubro de 2026" sections={SECTIONS} />;
}
