import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { useKnownTechniques } from "@/lib/queries";
import { Button, ErrorText, Loading, Txt } from "@/ui/kit";
import { Header, useWide } from "@/ui/shell";
import { TechniqueGraphView } from "@/ui/technique-graph";
import { CategoryLegend } from "@/ui/techniques";
import { space } from "@/ui/theme";

/** The athlete's own map, full screen: techniques they know or logged. */
export default function MyTechniqueMap() {
  const t = useT();
  const wide = useWide();
  const known = useKnownTechniques();
  return (
    <>
      <Header
        title={t.techniques.myMap}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      {/* The floating dock covers the bottom of the screen on phones. */}
      <View style={{ flex: 1, paddingBottom: wide ? 0 : 96 }}>
        {known.isPending ? <Loading /> : null}
        <ErrorText error={known.error} />
        {known.data ? (
          <>
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <CategoryLegend />
            </View>
            <TechniqueGraphView graph={known.data} onOpen={(id) => router.push(`/tecnicas/${id}`)} />
            <Txt v="tiny" muted style={{ textAlign: "center", padding: space.sm }}>{t.techniques.mapHint}</Txt>
          </>
        ) : null}
      </View>
    </>
  );
}
