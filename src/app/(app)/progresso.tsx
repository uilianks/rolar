import { router } from "expo-router";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import Clock from "lucide-react-native/icons/clock";
import Flame from "lucide-react-native/icons/flame";
import Swords from "lucide-react-native/icons/swords";
import { useState } from "react";
import { View } from "react-native";

import { duration, hours, when } from "@/lib/format";
import { useFeed, useMe, useStats } from "@/lib/queries";
import { KIND_LABEL } from "@/shared/domain";
import { Badge, Bars, Card, CardHead, Col, ErrorText, Heatmap, Kpi, ListRow, Loading, Progress, Row, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const BAND = {
  low: { label: "Abaixo do normal", tone: "default" as const, text: "Semana mais leve que as últimas quatro. Bom para recuperar, ou hora de voltar ao ritmo." },
  ideal: { label: "Ideal", tone: "success" as const, text: "Dentro da faixa das suas últimas quatro semanas. Bom momento para manter o ritmo." },
  high: { label: "Alta", tone: "accent" as const, text: "Bem acima das últimas quatro semanas. Cuidado com o excesso: descanso também é treino." },
  none: { label: "Sem dados", tone: "default" as const, text: "Registre treinos com intensidade para ver a sua carga semanal." },
};

export default function ProgressScreen() {
  const { c } = useTheme();
  const [range, setRange] = useState<"month" | "year" | "all">("year");
  const stats = useStats(range);
  const me = useMe().data;
  const diary = useFeed("me");
  const s = stats.data;
  const colors = [c.fg, c.accent, c.ring, c.warn, c.success, "#7c3aed", "#2563eb"];

  return (
    <>
      <Header
        title="Progresso"
        right={
          <View style={{ width: 210 }}>
            <Tabs value={range} onChange={setRange} options={[{ value: "month", label: "Mês" }, { value: "year", label: "Ano" }, { value: "all", label: "Tudo" }]} />
          </View>
        }
      />
      <Screen wide onRefresh={() => stats.refetch()} refreshing={stats.isRefetching}>
        {stats.isPending ? <Loading /> : null}
        <ErrorText error={stats.error} />
        {s ? (
          <>
            <Row wrap gap={space.md}>
              <Kpi icon={CalendarCheck} label="Treinos" value={String(s.totals.sessions)} />
              <Kpi icon={Clock} label="Horas no tatame" value={hours(s.totals.minutes)} />
              <Kpi icon={Flame} label="Sequência" value={`${s.streakWeeks} sem`} sub={me?.profile?.weeklyGoal ? `meta: ${me.profile.weeklyGoal}/semana` : "meta: 1/semana"} />
              <Kpi icon={Swords} label="Rolas" value={String(s.totals.rounds)} />
            </Row>

            <Card pad={false}>
              <CardHead title="Dias no tatame" right={<Txt v="small" muted>últimos 6 meses</Txt>} />
              <View style={{ padding: space.lg, gap: 10 }}>
                <Heatmap days={s.days} />
                <Row style={{ justifyContent: "flex-end" }} gap={3}>
                  <Txt v="tiny" muted>menos</Txt>
                  {c.heat.map((h) => (
                    <View key={h} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: h }} />
                  ))}
                  <Txt v="tiny" muted>mais</Txt>
                </Row>
              </View>
            </Card>

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title="Carga semanal" right={<Badge tone={BAND[s.loadBand].tone}>{BAND[s.loadBand].label}</Badge>} />
                <View style={{ padding: space.lg, gap: 12 }}>
                  <Bars
                    highlightLast
                    data={s.weeklyLoad.map((w, i) => ({
                      label: i === s.weeklyLoad.length - 1 ? "esta" : `${w.week.slice(8, 10)}/${w.week.slice(5, 7)}`,
                      value: w.load,
                    }))}
                  />
                  <Txt v="small" muted>
                    Duração × intensidade. Esta semana: <Txt v="small" bold>{s.weeklyLoad.at(-1)?.load ?? 0}</Txt>. {BAND[s.loadBand].text}
                  </Txt>
                </View>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title="Como você treina" />
                <View style={{ padding: space.lg, gap: 12 }}>
                  {s.byKind.length ? (
                    <>
                      <Row gap={0} style={{ height: 8, borderRadius: 999, overflow: "hidden" }}>
                        {s.byKind.map((k, i) => (
                          <View key={k.kind} style={{ flex: k.sessions, backgroundColor: colors[i % colors.length] }} />
                        ))}
                      </Row>
                      {s.byKind.map((k, i) => (
                        <Row key={k.kind}>
                          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[i % colors.length] }} />
                          <Txt style={{ flex: 1 }}>{KIND_LABEL[k.kind]}</Txt>
                          <Txt bold>{Math.round((k.sessions / s.totals.sessions) * 100)}%</Txt>
                        </Row>
                      ))}
                    </>
                  ) : (
                    <Txt v="small" muted>Sem treinos neste período.</Txt>
                  )}
                </View>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title="Meta da semana" />
                <Col style={{ padding: space.lg }}>
                  {s.thisWeek.goal ? (
                    <>
                      <Row style={{ justifyContent: "space-between" }}>
                        <Txt bold>{s.thisWeek.goal} treinos por semana</Txt>
                        <Txt v="small" muted>{s.thisWeek.sessions}/{s.thisWeek.goal}</Txt>
                      </Row>
                      <Progress value={s.thisWeek.sessions / s.thisWeek.goal} />
                    </>
                  ) : (
                    <Txt v="small" muted>Sem meta definida. Ajuste em Configurações.</Txt>
                  )}
                  <Txt v="small" muted>{duration(s.thisWeek.minutes)} no tatame esta semana.</Txt>
                </Col>
              </Card>
            </Row>
          </>
        ) : null}

        <Card pad={false}>
          <CardHead title="Diário" />
          {(diary.data?.pages.flatMap((p) => p.items) ?? []).map((d) => (
            <ListRow key={d.id} onPress={() => router.push(`/treino/${d.id}`)}>
              <View style={{ width: 70 }}>
                <Badge>{KIND_LABEL[d.kind]}</Badge>
              </View>
              <View style={{ flex: 1 }}>
                <Txt bold numberOfLines={1}>{d.title || `Treino de ${KIND_LABEL[d.kind].toLowerCase()}`}</Txt>
                <Txt v="tiny" muted>{when(d.startedAt)} · {duration(d.durationMin)} · intensidade {d.rpe}</Txt>
              </View>
            </ListRow>
          ))}
          {diary.hasNextPage ? (
            <ListRow onPress={() => diary.fetchNextPage()}>
              <Txt v="small" muted>Carregar mais</Txt>
            </ListRow>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}
