import Code from "lucide-react-native/icons/code";
import Coffee from "lucide-react-native/icons/coffee";
import Heart from "lucide-react-native/icons/heart";
import Languages from "lucide-react-native/icons/languages";
import Megaphone from "lucide-react-native/icons/megaphone";
import { Linking, Platform, View } from "react-native";

import { DONATIONS } from "@/lib/donations";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, Col, ListRow, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

/** Google Play only allows in-app donations for verified charities, so Android links to the website. */
const IN_APP_DONATIONS = Platform.OS === "web";

export default function Support() {
  const t = useT();
  const { c } = useTheme();
  const open = (url: string) => void Linking.openURL(url);

  return (
    <>
      <Header title={t.nav.support} />
      <Screen wide>
        <Col gap={10} style={{ alignItems: "center", paddingVertical: space.lg }}>
          <Badge>Open source · AGPL-3.0</Badge>
          <Txt v="h1" style={{ fontSize: 30, textAlign: "center", fontWeight: "800", maxWidth: 640 }}>{t.support.title}</Txt>
          <Txt muted style={{ textAlign: "center", maxWidth: 520 }}>
            {t.support.text}
          </Txt>
        </Col>

        {IN_APP_DONATIONS ? (
          <Row wrap gap={space.md} style={{ alignItems: "stretch" }}>
            <Card style={{ flexGrow: 1, flexBasis: 260, gap: 12 }}>
              <Txt v="h3">{t.support.once}</Txt>
              <Txt style={{ fontSize: 28, fontWeight: "800" }}>{t.support.anyAmount}</Txt>
              <Txt v="small" muted>{t.support.onceMethods}</Txt>
              <View style={{ flex: 1 }} />
              {DONATIONS.kofi ? <Button icon={Coffee} title={t.support.kofi} onPress={() => open(DONATIONS.kofi!)} /> : null}
            </Card>
            <Card style={{ flexGrow: 1, flexBasis: 260, gap: 12, borderColor: c.fg, borderWidth: 2 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="h3">{t.support.monthly}</Txt>
                <Badge tone="accent">{t.support.mostUseful}</Badge>
              </Row>
              <Txt style={{ fontSize: 28, fontWeight: "800" }}>{t.support.monthlyAmount}<Txt muted>{t.support.perMonth}</Txt></Txt>
              <Txt v="small" muted>{t.support.monthlyText}</Txt>
              <View style={{ flex: 1 }} />
              {DONATIONS.github ? <Button kind="primary" icon={Heart} title="GitHub Sponsors" onPress={() => open(DONATIONS.github!)} /> : null}
              {DONATIONS.liberapay ? <Button icon={Heart} title={t.support.liberapay} onPress={() => open(DONATIONS.liberapay!)} /> : null}
            </Card>
          </Row>
        ) : (
          <Card style={{ gap: 12 }}>
            <Txt>{t.support.openSite}</Txt>
            {DONATIONS.page ? <Button kind="primary" icon={Heart} title={t.support.viaSite} onPress={() => open(DONATIONS.page!)} /> : null}
          </Card>
        )}

        <Card pad={false}>
          <View style={{ padding: space.lg }}>
            <Txt v="h3">{t.support.otherWays}</Txt>
          </View>
          <ListRow onPress={DONATIONS.repo ? () => open(DONATIONS.repo!) : undefined}>
            <Code size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>{t.support.code}</Txt>
          </ListRow>
          <ListRow onPress={DONATIONS.repo ? () => open(DONATIONS.repo!) : undefined}>
            <Languages size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>{t.support.translate}</Txt>
          </ListRow>
          <ListRow>
            <Megaphone size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>{t.support.recommend}</Txt>
          </ListRow>
        </Card>
      </Screen>
    </>
  );
}
