import { type Href, router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import BookOpen from "lucide-react-native/icons/book-open";
import Check from "lucide-react-native/icons/check";
import Network from "lucide-react-native/icons/network";
import Plus from "lucide-react-native/icons/plus";
import { useDeferredValue, useState } from "react";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { useAcademy, useMe, useMyAcademies, useStaffAcademies, useTechniques, useToggleKnown } from "@/lib/queries";
import { TECHNIQUE_CATEGORIES, type TechniqueCategory } from "@/shared/domain";
import { Button, Card, Empty, ErrorText, Input, ListRow, Loading, Row, Segmented, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { CategoryDot, newTechniqueHref, techniqueMapHref } from "@/ui/techniques";

type Tab = "academy" | "rolar";

/**
 * The technique catalog. Two tabs, the athlete's academies first, then Rolar's own catalog; or one
 * academy's techniques only (`?academia=`, from its page). `?aba=rolar` opens on the Rolar tab.
 */
export default function TechniqueCatalog() {
  const t = useT();
  const params = useLocalSearchParams<{ q?: string; academia?: string; aba?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  const [category, setCategory] = useState<TechniqueCategory | "">("");
  const [tab, setTab] = useState<Tab>(params.aba === "rolar" ? "rolar" : "academy");
  const academy = useAcademy(params.academia).data;
  const mine = useMyAcademies();
  const staffAt = useStaffAcademies();
  const admin = !!useMe().data?.admin;
  const toggle = useToggleKnown();
  const rolar = !params.academia && tab === "rolar";
  const list = useTechniques({
    q: useDeferredValue(q.trim()),
    category,
    ...(params.academia ? { academy: params.academia } : { scope: rolar ? "rolar" : "mine" }),
  });
  const noAcademy = !params.academia && !rolar && !mine.length;

  // "+" adds to the catalog on screen: Rolar's (admins), the academy being browsed (its staff or an
  // admin), or the viewer's own academy on the academy tab.
  const addTo: string | null | undefined = rolar
    ? admin ? null : undefined
    : params.academia
      ? admin || staffAt.some((a) => a.id === params.academia) ? params.academia : undefined
      : staffAt[0]?.id;
  const add = addTo !== undefined ? () => router.push(newTechniqueHref(addTo) as Href) : undefined;
  // The map of what is on screen: Rolar's, the academy browsed, or the athlete's only academy.
  const mapOf = rolar ? null : (params.academia ?? (mine.length === 1 ? mine[0].id : undefined));

  return (
    <>
      <Header
        title={academy ? `${t.techniques.title} · ${academy.name}` : t.techniques.title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={
          <Row gap={4}>
            {mapOf !== undefined ? <Button size="sm" icon={Network} title={t.techniques.map} onPress={() => router.push(techniqueMapHref(mapOf) as Href)} /> : null}
            {add ? <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.techniques.new} onPress={add} /> : null}
          </Row>
        }
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        {params.academia ? null : (
          <Tabs<Tab> value={tab} onChange={setTab} options={[{ value: "academy", label: t.techniques.tabAcademy }, { value: "rolar", label: t.techniques.tabRolar }]} />
        )}
        {noAcademy ? (
          <Card>
            <Empty
              icon={BookOpen}
              title={t.techniques.noAcademyTitle}
              text={t.techniques.noAcademyText}
              action={
                <Row wrap>
                  <Button size="sm" kind="primary" title={t.techniques.useRolar} onPress={() => setTab("rolar")} />
                  <Button size="sm" title={t.techniques.findAcademy} onPress={() => router.push("/academia/buscar")} />
                </Row>
              }
            />
          </Card>
        ) : (
          <>
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
                        {[t.techniqueCategory[k.category], k.position ? t.techniquePosition[k.position] : null, !academy && mine.length > 1 ? k.academy?.name : null]
                          .filter(Boolean)
                          .join(" · ")}
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
          </>
        )}
      </Screen>
    </>
  );
}
