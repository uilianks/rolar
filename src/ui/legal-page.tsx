import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { ScrollView } from "react-native";

import { Button, Col, Txt } from "./kit";
import { Header } from "./shell";
import { space, useTheme } from "./theme";

/** Public legal text (privacy policy, terms): readable without an account. */
export function LegalPage({ title, version, sections }: { title: string; version: string; sections: [string, string][] }) {
  const { c } = useTheme();
  return (
    <>
      <Header
        title={title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, gap: space.lg, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Txt v="h1">{title}</Txt>
        <Txt v="small" muted>{version}</Txt>
        {sections.map(([heading, body]) => (
          <Col key={heading} gap={4}>
            <Txt v="h3">{heading}</Txt>
            <Txt>{body}</Txt>
          </Col>
        ))}
      </ScrollView>
    </>
  );
}
