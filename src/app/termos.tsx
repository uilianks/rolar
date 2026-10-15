// Public (no login): the rules of use that moderation and account removal rely on; linked next to the privacy policy.
import { LegalPage } from "@/ui/legal-page";

const CONTACT = "contato@rolar.app";

const SECTIONS: [string, string][] = [
  [
    "O serviço",
    `O rolar (rolar.app) é um diário de treino de jiu-jitsu, grátis e open source (AGPL-3.0), mantido por Uilian Kidricki (${CONTACT}) e financiado por doações. Ao criar conta você aceita estes termos e a política de privacidade.`,
  ],
  ["Conta", "É preciso ter 13 anos ou mais. A conta é pessoal: use o seu nome e o seu próprio e-mail ou conta Google, e não a partilhe."],
  [
    "Regras de convivência",
    "Respeite os outros como no tatame: nada de assédio, ofensas, discriminação, ameaças, conteúdo sexual, spam ou divulgação de dados de terceiros. Não se passe por outra pessoa nem por uma academia que não representa. Professores só confirmam graduações e presenças que aconteceram de verdade.",
  ],
  [
    "Academias",
    "Quem cadastra uma academia declara representá-la, e o cadastro é verificado antes de ficar visível. O responsável é quem aprova os alunos e responde pelos dados que regista sobre eles, como presenças, graduações e mensalidades. O rolar não cobra mensalidades nem movimenta dinheiro; o registo de pagamentos é só um controlo da academia.",
  ],
  [
    "O seu conteúdo",
    "Treinos, comentários e fotos continuam seus. Você nos autoriza a guardá-los e mostrá-los a quem escolheu nas definições de visibilidade, só para o app funcionar. Ao apagar a conta, eles são apagados.",
  ],
  [
    "Moderação",
    "Qualquer pessoa pode denunciar um perfil, treino ou comentário. Conteúdo que viole estas regras pode ser removido, e contas que as violem repetidamente ou gravemente podem ser suspensas ou apagadas. Se discordar de uma decisão, escreva para o contacto acima e ela é revista por uma pessoa.",
  ],
  [
    "Saúde e segurança",
    "O jiu-jitsu tem risco de lesão. As estatísticas e a carga semanal do app são informativas e não substituem orientação médica, de um professor ou de um preparador físico.",
  ],
  [
    "Doações",
    "As doações são voluntárias, não dão acesso a funções extra e não são reembolsáveis, exceto quando a lei o exigir. São feitas pelo GitHub Sponsors ou pelo Ko-fi, com as condições desses serviços.",
  ],
  [
    "Garantia e responsabilidade",
    "O app é oferecido como está, por voluntários, sem garantia de funcionar sempre ou sem erros. Na medida permitida por lei, não respondemos por perdas indiretas. Nada nestes termos limita os direitos que a lei do consumidor lhe dá.",
  ],
  [
    "Alterações e lei aplicável",
    "Se estes termos mudarem de forma relevante, avisamos no app antes de a mudança valer. Aplica-se a lei portuguesa, sem prejuízo das regras de proteção do consumidor do seu país de residência.",
  ],
];

export default function Terms() {
  return <LegalPage title="Termos de uso" version="Versão 1.0 · 15 de outubro de 2026" sections={SECTIONS} />;
}
