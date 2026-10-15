import Code from "lucide-react-native/icons/code";
import Coffee from "lucide-react-native/icons/coffee";
import Heart from "lucide-react-native/icons/heart";
import Languages from "lucide-react-native/icons/languages";
import Megaphone from "lucide-react-native/icons/megaphone";
import { Linking, Platform, View } from "react-native";

import { DONATIONS } from "@/lib/donations";
import { Badge, Button, Card, Col, ListRow, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

/** Google Play only allows in-app donations for verified charities, so Android links to the website. */
const IN_APP_DONATIONS = Platform.OS === "web";

export default function Support() {
  const { c } = useTheme();
  const open = (url: string) => void Linking.openURL(url);

  return (
    <>
      <Header title="Apoie o projeto" />
      <Screen wide>
        <Col gap={10} style={{ alignItems: "center", paddingVertical: space.lg }}>
          <Badge>Open source · AGPL-3.0</Badge>
          <Txt v="h1" style={{ fontSize: 30, textAlign: "center", fontWeight: "800", maxWidth: 640 }}>Sem anúncios. Sem paywall. Mantido por quem treina.</Txt>
          <Txt muted style={{ textAlign: "center", maxWidth: 520 }}>
            Todas as funções são grátis para todo mundo. As doações pagam servidor, banco de dados e as contas das lojas de apps.
          </Txt>
        </Col>

        {IN_APP_DONATIONS ? (
          <Row wrap gap={space.md} style={{ alignItems: "stretch" }}>
            <Card style={{ flexGrow: 1, flexBasis: 260, gap: 12 }}>
              <Txt v="h3">Uma vez</Txt>
              <Txt style={{ fontSize: 28, fontWeight: "800" }}>Qualquer valor</Txt>
              <Txt v="small" muted>Cartão, PayPal, Apple Pay ou Google Pay, sem criar conta.</Txt>
              <View style={{ flex: 1 }} />
              {DONATIONS.kofi ? <Button icon={Coffee} title="Doar pelo Ko-fi" onPress={() => open(DONATIONS.kofi!)} /> : null}
            </Card>
            <Card style={{ flexGrow: 1, flexBasis: 260, gap: 12, borderColor: c.fg, borderWidth: 2 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="h3">Mensal</Txt>
                <Badge tone="accent">mais útil</Badge>
              </Row>
              <Txt style={{ fontSize: 28, fontWeight: "800" }}>3 €<Txt muted>/mês</Txt></Txt>
              <Txt v="small" muted>Doação recorrente previsível ajuda a planejar. Cancela quando quiser.</Txt>
              <View style={{ flex: 1 }} />
              {DONATIONS.github ? <Button kind="primary" icon={Heart} title="GitHub Sponsors" onPress={() => open(DONATIONS.github!)} /> : null}
              {DONATIONS.liberapay ? <Button icon={Heart} title="Liberapay (SEPA, cartão)" onPress={() => open(DONATIONS.liberapay!)} /> : null}
            </Card>
          </Row>
        ) : (
          <Card style={{ gap: 12 }}>
            <Txt>Para doar, abra a página de apoio no site do projeto.</Txt>
            {DONATIONS.page ? <Button kind="primary" icon={Heart} title="Apoiar pelo site" onPress={() => open(DONATIONS.page!)} /> : null}
          </Card>
        )}

        <Card pad={false}>
          <View style={{ padding: space.lg }}>
            <Txt v="h3">Outras formas de ajudar</Txt>
          </View>
          <ListRow onPress={DONATIONS.repo ? () => open(DONATIONS.repo!) : undefined}>
            <Code size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>Contribuir com código</Txt>
          </ListRow>
          <ListRow onPress={DONATIONS.repo ? () => open(DONATIONS.repo!) : undefined}>
            <Languages size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>Traduzir o app</Txt>
          </ListRow>
          <ListRow>
            <Megaphone size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>Indicar para a sua academia</Txt>
          </ListRow>
        </Card>
      </Screen>
    </>
  );
}
