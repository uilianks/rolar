import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import BookOpen from "lucide-react-native/icons/book-open";
import Check from "lucide-react-native/icons/check";
import Network from "lucide-react-native/icons/network";
import Plus from "lucide-react-native/icons/plus";
import { useDeferredValue, useState } from "react";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { useAcademy, useStaffAcademies, useTechniques, useToggleKnown } from "@/lib/queries";
import { TECHNIQUE_CATEGORIES, type TechniqueCategory } from "@/shared/domain";
import { Button, Card, Empty, ErrorText, Input, ListRow, Loading, Row, Segmented, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { CategoryDot } from "@/ui/techniques";

/** The technique catalog: search every academy's techniques, or one academy's (`?academia=`). */
export default function TechniqueCatalog() {
  const t = useT();
  const params = useLocalSearchParams<{ q?: string; academia?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  const [category, setCategory] = useState<TechniqueCategory | "">("");
  const academy = useAcademy(params.academia).data;
  const staffAt = useStaffAcademies();
  // Where "+" adds to: the academy being browsed if the viewer teaches there, else their first one.
  const addTo = params.academia ? staffAt.find((a) => a.id === params.academia) : staffAt[0];
  const add = addTo ? () => router.push(`/academia/${addTo.id}/tecnica`) : undefined;
  const toggle = useToggleKnown();
  const list = useTechniques({ q: useDeferredValue(q.trim()), category, academy: params.academia });

  return (
    <>
      <Header
        title={academy ? `${t.techniques.title} · ${academy.name}` : t.techniques.title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={
          <Row gap={4}>
            {academy ? <Button size="sm" icon={Network} title={t.techniques.map} onPress={() => router.push(`/academia/${academy.id}/mapa`)} /> : null}
            {add ? <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.techniques.new} onPress={add} /> : null}
          </Row>
        }
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Input value={q} onChangeText={setQ} placeholder={t.techniques.searchPlaceholder} autoCapitalize="none" accessibilityLabel={t.techniques.searchPlaceholder} />
        <Segmented
          value={category}
          onChange={setCategory}
          options={[{ value: "" as const, label: t.techniques.all }, ...TECHNIQUE_CATEGORIES.map((k) => ({ value: k, label: t.techniqueCategory[k] }))]}
        />
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error ?? toggle.error} />
        {list.data?.length ? (
          <Card pad={false}>
            {list.data.map((k) => (
              <ListRow key={k.id} onPress={() => router.push(`/tecnicas/${k.id}`)}>
                <CategoryDot category={k.category} />
                <View style={{ flex: 1 }}>
                  <Txt bold numberOfLines={1}>{k.name}</Txt>
                  <Txt v="tiny" muted numberOfLines={1}>
                    {[t.techniqueCategory[k.category], k.position ? t.techniquePosition[k.position] : null, academy ? null : k.academy.name].filter(Boolean).join(" · ")}
                  </Txt>
                </View>
                {/* Add to (or take off) the viewer's own map without opening the technique. */}
                <Button
                  size="sm"
                  kind={k.known ? "primary" : "default"}
                  icon={k.known ? Check : Plus}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: k.known }}
                  accessibilityLabel={k.known ? `${k.name}: ${t.techniques.known}` : `${k.name}: ${t.techniques.iKnow}`}
                  disabled={toggle.isPending && toggle.variables?.id === k.id}
                  onPress={() => toggle.mutate({ id: k.id, known: !k.known })}
                />
              </ListRow>
            ))}
          </Card>
        ) : null}
        {list.data && !list.data.length ? (
          <Card>
            <Empty
              icon={BookOpen}
              title={t.techniques.empty}
              text={add ? t.techniques.emptyStaff : t.techniques.emptyText}
              action={add ? <Button size="sm" kind="primary" title={t.techniques.new} onPress={add} /> : undefined}
            />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
