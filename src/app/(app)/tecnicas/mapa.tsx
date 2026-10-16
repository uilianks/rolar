import { type Href, router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Plus from "lucide-react-native/icons/plus";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { useKnownTechniques, useMe, useTechniqueGraph } from "@/lib/queries";
import { Button, ErrorText, Loading, Txt } from "@/ui/kit";
import { Header, useWide } from "@/ui/shell";
import { TechniqueGraphView } from "@/ui/technique-graph";
import { CategoryLegend, newTechniqueHref } from "@/ui/techniques";
import { space } from "@/ui/theme";

/** Full-screen map: the athlete's own (what they know or logged), or Rolar's catalog (`?escopo=rolar`). */
export default function TechniqueMapScreen() {
  const t = useT();
  const wide = useWide();
  const { escopo, focus } = useLocalSearchParams<{ escopo?: string; focus?: string }>();
  const rolar = escopo === "rolar";
  const known = useKnownTechniques();
  const catalog = useTechniqueGraph(rolar ? "rolar" : undefined);
  const graph = rolar ? catalog : known;
  const admin = !!useMe().data?.admin;
  return (
    <>
      <Header
        title={rolar ? t.techniques.rolarMap : t.techniques.myMap}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={rolar && admin ? <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.techniques.new} onPress={() => router.push(newTechniqueHref(null) as Href)} /> : undefined}
      />
      {/* The floating dock covers the bottom of the screen on phones. */}
      <View style={{ flex: 1, paddingBottom: wide ? 0 : 96 }}>
        {graph.isPending ? <Loading /> : null}
        <ErrorText error={graph.error} />
        {graph.data ? (
          <>
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <CategoryLegend />
            </View>
            <TechniqueGraphView graph={graph.data} focus={focus} onOpen={(id) => router.push(`/tecnicas/${id}`)} />
            <Txt v="tiny" muted style={{ textAlign: "center", padding: space.sm }}>{t.techniques.mapHint}</Txt>
          </>
        ) : null}
      </View>
    </>
  );
}
