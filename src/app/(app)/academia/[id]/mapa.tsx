import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import List from "lucide-react-native/icons/list";
import Network from "lucide-react-native/icons/network";
import Plus from "lucide-react-native/icons/plus";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { useAcademy, useStaffAcademies, useTechniqueGraph } from "@/lib/queries";
import { Button, Card, Empty, ErrorText, Loading, Row, Txt } from "@/ui/kit";
import { Header, useWide } from "@/ui/shell";
import { TechniqueGraphView } from "@/ui/technique-graph";
import { CategoryLegend } from "@/ui/techniques";
import { space } from "@/ui/theme";

/** The academy's techniques as a graph; `?focus=` opens centred on one. */
export default function TechniqueMap() {
  const t = useT();
  const wide = useWide();
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const academy = useAcademy(id).data;
  const graph = useTechniqueGraph(academy?.id);
  const staff = useStaffAcademies().some((a) => a.id === academy?.id);

  return (
    <>
      <Header
        title={academy ? `${t.techniques.mapTitle} · ${academy.name}` : t.techniques.mapTitle}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
        right={
          <Row gap={4}>
            <Button size="sm" icon={List} title={t.techniques.title} onPress={() => router.push(`/tecnicas?academia=${academy?.id ?? id}`)} />
            {staff ? <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.techniques.new} onPress={() => router.push(`/academia/${academy!.id}/tecnica`)} /> : null}
          </Row>
        }
      />
      {/* The floating dock covers the bottom of the screen on phones. */}
      <View style={{ flex: 1, paddingBottom: wide ? 0 : 96 }}>
        {graph.isPending ? <Loading /> : null}
        <ErrorText error={graph.error} />
        {graph.data?.nodes.length ? (
          <>
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <CategoryLegend />
            </View>
            <TechniqueGraphView graph={graph.data} focus={focus} onOpen={(tid) => router.push(`/tecnicas/${tid}`)} />
            <Txt v="tiny" muted style={{ textAlign: "center", padding: space.sm }}>{t.techniques.mapHint}</Txt>
          </>
        ) : null}
        {graph.data && !graph.data.nodes.length ? (
          <View style={{ padding: space.lg }}>
            <Card>
              <Empty icon={Network} title={t.techniques.mapEmpty} action={staff ? <Button size="sm" kind="primary" title={t.techniques.new} onPress={() => router.push(`/academia/${academy!.id}/tecnica`)} /> : undefined} />
            </Card>
          </View>
        ) : null}
      </View>
    </>
  );
}
