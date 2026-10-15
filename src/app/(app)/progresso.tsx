import { router } from "expo-router";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import Clock from "lucide-react-native/icons/clock";
import Flame from "lucide-react-native/icons/flame";
import Swords from "lucide-react-native/icons/swords";
import { useState } from "react";
import { View } from "react-native";

import { duration, hours, when } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useFeed, useMe, useStats } from "@/lib/queries";
import { Badge, Bars, Card, CardHead, Col, ErrorText, Heatmap, Kpi, ListRow, Loading, Progress, Row, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const BAND_TONE = { low: "default", ideal: "success", high: "accent", none: "default" } as const;

export default function ProgressScreen() {
  const t = useT();
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
        title={t.nav.progress}
        right={
          <View style={{ width: 210 }}>
            <Tabs value={range} onChange={setRange} options={[{ value: "month", label: t.progress.month }, { value: "year", label: t.progress.year }, { value: "all", label: t.progress.all }]} />
          </View>
        }
      />
      <Screen wide onRefresh={() => stats.refetch()} refreshing={stats.isRefetching}>
        {stats.isPending ? <Loading /> : null}
        <ErrorText error={stats.error} />
        {s ? (
          <>
            <Row wrap gap={space.md}>
              <Kpi icon={CalendarCheck} label={t.profile.sessions} value={String(s.totals.sessions)} />
              <Kpi icon={Clock} label={t.profile.matHours} value={hours(s.totals.minutes)} />
              <Kpi icon={Flame} label={t.progress.streak} value={t.progress.weeks(s.streakWeeks)} sub={t.progress.goalPerWeek(me?.profile?.weeklyGoal || 1)} />
              <Kpi icon={Swords} label={t.session.rounds} value={String(s.totals.rounds)} />
            </Row>

            <Card pad={false}>
              <CardHead title={t.profile.matDays} right={<Txt v="small" muted>{t.progress.last6Months}</Txt>} />
              <View style={{ padding: space.lg, gap: 10 }}>
                <Heatmap days={s.days} />
                <Row style={{ justifyContent: "flex-end" }} gap={3}>
                  <Txt v="tiny" muted>{t.progress.less}</Txt>
                  {c.heat.map((h) => (
                    <View key={h} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: h }} />
                  ))}
                  <Txt v="tiny" muted>{t.progress.more}</Txt>
                </Row>
              </View>
            </Card>

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title={t.progress.weeklyLoad} right={<Badge tone={BAND_TONE[s.loadBand]}>{t.progress.band[s.loadBand].label}</Badge>} />
                <View style={{ padding: space.lg, gap: 12 }}>
                  <Bars
                    highlightLast
                    data={s.weeklyLoad.map((w, i) => ({
                      label: i === s.weeklyLoad.length - 1 ? "esta" : `${w.week.slice(8, 10)}/${w.week.slice(5, 7)}`,
                      value: w.load,
                    }))}
                  />
                  <Txt v="small" muted>
                    {t.progress.loadThisWeek}<Txt v="small" bold>{s.weeklyLoad.at(-1)?.load ?? 0}</Txt>. {t.progress.band[s.loadBand].text}
                  </Txt>
                </View>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title={t.progress.howYouTrain} />
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
                          <Txt style={{ flex: 1 }}>{t.sessionKind[k.kind]}</Txt>
                          <Txt bold>{Math.round((k.sessions / s.totals.sessions) * 100)}%</Txt>
                        </Row>
                      ))}
                    </>
                  ) : (
                    <Txt v="small" muted>{t.progress.noSessions}</Txt>
                  )}
                </View>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 300 }}>
                <CardHead title={t.progress.weekGoal} />
                <Col style={{ padding: space.lg }}>
                  {s.thisWeek.goal ? (
                    <>
                      <Row style={{ justifyContent: "space-between" }}>
                        <Txt bold>{t.progress.sessionsPerWeek(s.thisWeek.goal)}</Txt>
                        <Txt v="small" muted>{s.thisWeek.sessions}/{s.thisWeek.goal}</Txt>
                      </Row>
                      <Progress value={s.thisWeek.sessions / s.thisWeek.goal} />
                    </>
                  ) : (
                    <Txt v="small" muted>{t.progress.noGoal}</Txt>
                  )}
                  <Txt v="small" muted>{duration(s.thisWeek.minutes)} no tatame esta semana.</Txt>
                </Col>
              </Card>
            </Row>
          </>
        ) : null}

        <Card pad={false}>
          <CardHead title={t.progress.log} />
          {(diary.data?.pages.flatMap((p) => p.items) ?? []).map((d) => (
            <ListRow key={d.id} onPress={() => router.push(`/treino/${d.id}`)}>
              <View style={{ width: 70 }}>
                <Badge>{t.sessionKind[d.kind]}</Badge>
              </View>
              <View style={{ flex: 1 }}>
                <Txt bold numberOfLines={1}>{d.title || t.sessionTitle(t.sessionKind[d.kind])}</Txt>
                <Txt v="tiny" muted>{when(d.startedAt)} · {duration(d.durationMin)} · intensidade {d.rpe}</Txt>
              </View>
            </ListRow>
          ))}
          {diary.hasNextPage ? (
            <ListRow onPress={() => diary.fetchNextPage()}>
              <Txt v="small" muted>{t.common.loadMore}</Txt>
            </ListRow>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}
