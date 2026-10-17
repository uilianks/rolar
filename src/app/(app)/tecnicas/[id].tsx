import { useQueryClient } from "@tanstack/react-query";
import { type Href, router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import Network from "lucide-react-native/icons/network";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { useT } from "@/lib/i18n";
import { useTechnique, useToggleKnown } from "@/lib/queries";
import type { TechniqueRef } from "@/lib/types";
import { Badge, Button, Card, Col, ErrorText, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { TechniqueNotesCard } from "@/ui/technique-notes";
import { CategoryDot, editTechniqueHref, newTechniqueHref, TechniqueChip, techniqueMapHref } from "@/ui/techniques";
import { space } from "@/ui/theme";

function Links({ title, items }: { title: string; items: TechniqueRef[] }) {
  if (!items.length) return null;
  return (
    <Col gap={space.sm}>
      <Txt v="small" bold>{title}</Txt>
      <Row wrap gap={space.sm}>
        {items.map((k) => (
          <TechniqueChip key={k.id} name={k.name} category={k.category} onPress={() => router.push(`/tecnicas/${k.id}`)} />
        ))}
      </Row>
    </Col>
  );
}

export default function TechniqueScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTechnique(id);
  const k = query.data;
  const [error, setError] = useState<unknown>(null);
  const toggle = useToggleKnown();

  async function remove() {
    if (!k || !(await confirm(t.techniques.removeTitle(k.name), t.techniques.removeText, t.techniques.remove))) return;
    try {
      await api(`/techniques/${k.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["techniques"] });
      router.replace(k.academy ? `/tecnicas?academia=${k.academy.id}` : "/tecnicas?aba=rolar");
    } catch (e) {
      setError(e);
    }
  }

  return (
    <>
      <Header
        title={k?.name ?? t.techniques.title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/tecnicas"))} />}
        right={
          k?.canEdit ? (
            <Row gap={4}>
              <Button kind="ghost" icon={Pencil} accessibilityLabel={t.techniques.edit} onPress={() => router.push(editTechniqueHref(k.academy?.id ?? null, k.id) as Href)} />
              <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.techniques.new} onPress={() => router.push(newTechniqueHref(k.academy?.id ?? null) as Href)} />
            </Row>
          ) : undefined
        }
      />
      <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        {query.isPending ? <Loading /> : null}
        <ErrorText error={query.error ?? error ?? toggle.error} />
        {k ? (
          <>
            <Card style={{ gap: space.md }}>
              <Row gap={space.sm}>
                <CategoryDot category={k.category} size={12} />
                <Txt v="h2" style={{ flex: 1 }}>{k.name}</Txt>
              </Row>
              <Row wrap gap={6}>
                <Badge>{t.techniqueCategory[k.category]}</Badge>
                {k.position ? <Badge>{t.techniquePosition[k.position]}</Badge> : null}
              </Row>
              {k.aliases.length ? <Txt v="small" muted>{k.aliases.join(" · ")}</Txt> : null}
              <Txt v="small" muted onPress={k.academy ? () => router.push(`/academia/${k.academy!.id}`) : undefined}>
                {k.academy ? `${k.academy.name}${k.author ? ` · ${t.techniques.by(k.author.name)}` : ""}` : t.techniques.rolarTechnique}
              </Txt>
              <Button
                kind={k.known ? "primary" : "default"}
                icon={k.known ? Check : undefined}
                title={k.known ? t.techniques.known : t.techniques.iKnow}
                accessibilityRole="switch"
                accessibilityState={{ checked: k.known }}
                loading={toggle.isPending}
                onPress={() => toggle.mutate({ id: k.id, known: !k.known })}
                style={{ alignSelf: "flex-start" }}
              />
            </Card>
            <Card style={{ gap: space.sm }}>
              <Txt v="small" bold>{t.techniques.description}</Txt>
              <Txt muted={!k.description}>{k.description || t.techniques.noDescription}</Txt>
            </Card>
            <TechniqueNotesCard key={k.myNotes?.updatedAt ?? "none"} techniqueId={k.id} notes={k.myNotes} />
            {k.comesFrom.length || k.leadsTo.length ? (
              <Card style={{ gap: space.lg }}>
                <Links title={t.techniques.comesFrom} items={k.comesFrom} />
                <Links title={t.techniques.leadsTo} items={k.leadsTo} />
              </Card>
            ) : null}
            <Row wrap gap={space.sm}>
              <Button icon={Network} title={t.techniques.mapTitle} onPress={() => router.push(techniqueMapHref(k.academy?.id ?? null, k.id) as Href)} />
              {k.canEdit ? <Button kind="danger" title={t.techniques.remove} onPress={remove} /> : null}
            </Row>
          </>
        ) : null}
      </Screen>
    </>
  );
}
