// Public (no login): linked from the login screen and required by GDPR and the Play Store listing.
// DRAFT — the controller's identity and contact must be filled in before launch.
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { ScrollView } from "react-native";

import { Button, Col, Txt } from "@/ui/kit";
import { Header } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const SECTIONS: [string, string][] = [
  ["Quem somos", "O tatame é um projeto open source (AGPL-3.0) mantido por voluntários e financiado por doações. Responsável pelo tratamento: [nome e contacto a definir antes do lançamento]."],
  ["Que dados guardamos", "E-mail (para entrar), nome, nome de usuário, foto de perfil (se você enviar uma; menores não podem), ano de nascimento, faixa e graus, academias, treinos que você registra (data, duração, modalidade, rolas, intensidade, notas, técnicas), seguidores, Oss, comentários, graduações e denúncias que você faz. Se você cadastrar uma academia: os contactos oficiais dela (morada, telefone, e-mail, site, Instagram), o seu papel e a explicação que você der, usados só para verificar o cadastro. Não guardamos senha, localização nem dados de saúde de dispositivos."],
  ["Para que usamos", "Só para o funcionamento do app: mostrar o seu histórico e estatísticas, a sua academia e o feed das pessoas que você segue. Base legal: execução do contrato (art. 6.º, n.º 1, al. b) do RGPD). Não vendemos dados, não mostramos anúncios e não usamos rastreadores de terceiros."],
  ["Quem vê", "Cada treino tem a visibilidade que você escolhe: todos, seguidores ou só você. Ano de nascimento nunca é público. Menores de 18 anos não aparecem na busca, não publicam treinos para todos e só podem ser seguidos por membros da mesma academia."],
  ["Onde ficam", "Banco de dados Neon (Postgres) e hospedagem Vercel. O e-mail de login é enviado pela Resend. Pedimos a região da União Europeia sempre que o fornecedor permite."],
  ["Seus direitos", "Em Configurações você pode baixar todos os seus dados (portabilidade) e apagar a conta com tudo o que ela contém (apagamento). Para retificação, oposição ou dúvidas, contacte [e-mail a definir]. Você pode reclamar à CNPD ou à autoridade de proteção de dados do seu país."],
  ["Idade mínima", "É preciso ter 13 anos ou mais para criar conta."],
  ["Retenção", "Os dados ficam enquanto a conta existir. Ao apagar a conta, tudo é removido do banco imediatamente; cópias de segurança cifradas expiram em até 30 dias."],
];

export default function Privacy() {
  const { c } = useTheme();
  return (
    <>
      <Header
        title="Privacidade"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Txt v="h1">Política de privacidade</Txt>
        <Txt v="small" muted>Rascunho — versão 0.1</Txt>
        {SECTIONS.map(([title, body]) => (
          <Col key={title} gap={4}>
            <Txt v="h3">{title}</Txt>
            <Txt>{body}</Txt>
          </Col>
        ))}
      </ScrollView>
    </>
  );
}
