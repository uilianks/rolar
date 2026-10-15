// Public (no login): the rules of use that moderation and account removal rely on; linked next to the privacy policy.
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/shared/i18n";
import { LegalPage } from "@/ui/legal-page";

const CONTACT = "contato@rolar.app";

const PT: [string, string][] = [
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

const EN: [string, string][] = [
  [
    "The service",
    `rolar (rolar.app) is a jiu-jitsu training log, free and open source (AGPL-3.0), maintained by Uilian Kidricki (${CONTACT}) and funded by donations. By creating an account you accept these terms and the privacy policy. This is a translation; if it differs from the Portuguese version, the Portuguese version prevails.`,
  ],
  ["Account", "You must be 13 or older. Your account is personal: use your own name and your own e-mail or Google account, and do not share it."],
  [
    "Community rules",
    "Treat others as you would on the mat: no harassment, insults, discrimination, threats, sexual content, spam or sharing other people's data. Do not pretend to be someone else or an academy you do not represent. Coaches only confirm promotions and attendance that really happened.",
  ],
  [
    "Academies",
    "Whoever registers an academy declares that they represent it, and the registration is checked before it becomes visible. The person in charge approves the students and is responsible for the data they record about them, such as attendance, promotions and membership fees. rolar does not charge fees or move money; the payment log is only a record kept by the academy.",
  ],
  [
    "Your content",
    "Sessions, comments and photos remain yours. You allow us to store them and show them to whoever you chose in the visibility settings, only so the app can work. When you delete your account, they are deleted.",
  ],
  [
    "Moderation",
    "Anyone can report a profile, session or comment. Content that breaks these rules may be removed, and accounts that break them repeatedly or seriously may be suspended or deleted. If you disagree with a decision, write to the contact above and a person will review it.",
  ],
  [
    "Health and safety",
    "Jiu-jitsu carries a risk of injury. The app's statistics and weekly load are for information only and do not replace advice from a doctor, a coach or a strength and conditioning coach.",
  ],
  [
    "Donations",
    "Donations are voluntary, do not unlock extra features and are not refundable, except where the law requires it. They are made through GitHub Sponsors or Ko-fi, under those services' terms.",
  ],
  [
    "Warranty and liability",
    "The app is offered as is, by volunteers, with no guarantee that it will always work or be free of errors. To the extent permitted by law, we are not liable for indirect losses. Nothing in these terms limits the rights consumer law gives you.",
  ],
  [
    "Changes and governing law",
    "If these terms change in a meaningful way, we will tell you in the app before the change takes effect. Portuguese law applies, without prejudice to the consumer protection rules of your country of residence.",
  ],
];

const SECTIONS: Record<Locale, [string, string][]> = { pt: PT, en: EN };

export default function Terms() {
  const { t, locale } = useLocale();
  return <LegalPage title={t.legal.termsTitle} version={t.legal.version} sections={SECTIONS[locale]} />;
}
