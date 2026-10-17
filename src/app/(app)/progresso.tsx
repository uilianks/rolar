import CalendarCheck from "lucide-react-native/icons/calendar-check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock from "lucide-react-native/icons/clock";
import Flame from "lucide-react-native/icons/flame";
import Swords from "lucide-react-native/icons/swords";
import { useState } from "react";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { dateFmt, duration, hours } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useFeed, useMe, useStats, useTrends, useWeek } from "@/lib/queries";
import type { MonthTrend } from "@/lib/types";
import type { FinishCount } from "@/shared/domain";
import { Badge, Bars, Card, CardHead, Col, ErrorText, Heatmap, Kpi, ListRow, Loading, Progress, Row, Tabs, Txt } from "@/ui/kit";
import { SessionRow } from "@/ui/session-card";
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
        <WeekCard />
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

            <Card pad={false}>
              <CardHead title={t.finishes.title} right={<Txt v="small" muted>{t.finishes.ratio(s.submissions.total, s.taps.total)}</Txt>} />
              {s.submissions.total || s.taps.total ? (
                <Row wrap gap={space.lg} style={{ padding: space.lg, alignItems: "flex-start" }}>
                  <FinishTop title={t.finishes.top} items={s.submissions.top} color={c.accent} />
                  <FinishTop title={t.finishes.topTaps} items={s.taps.top} color={c.mutedFg} />
                </Row>
              ) : (
                <View style={{ padding: space.lg }}>
                  <Txt v="small" muted>{t.finishes.none}</Txt>
                </View>
              )}
            </Card>

            <TrendsCard />
          </>
        ) : null}

        <Card pad={false}>
          <CardHead title={t.progress.log} />
          {(diary.data?.pages.flatMap((p) => p.items) ?? []).map((d) => (
            <SessionRow key={d.id} s={d} />
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

function FinishTop({ title, items, color }: { title: string; items: FinishCount[]; color: string }) {
  const max = items[0]?.count ?? 1;
  return (
    <Col gap={8} style={{ flexGrow: 1, flexBasis: 240 }}>
      <Txt v="small" muted>{title}</Txt>
      {items.map((f) => (
        <Col key={f.name} gap={4}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt>{f.name}</Txt>
            <Txt bold>{f.count}</Txt>
          </Row>
          <Progress value={f.count / max} color={color} height={6} />
        </Col>
      ))}
    </Col>
  );
}

/** This week at a glance; opens the weekly report. */
function WeekCard() {
  const t = useT();
  const { c } = useTheme();
  const r = useWeek().data;
  if (!r) return null;
  const cur = r.current;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t.week.open} onPress={() => router.push("/semana")}>
      <Card>
        <Row gap={12}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: r.goalMet ? c.success : c.muted, alignItems: "center", justifyContent: "center" }}>
            <CalendarCheck size={18} color={r.goalMet ? "#fff" : c.fg} />
          </View>
          <Col gap={2} style={{ flex: 1 }}>
            <Txt bold>{t.week.title}</Txt>
            <Txt v="small" muted>
              {`${t.week.sessions(cur.sessions)} · ${duration(cur.minutes)}`}
              {r.goal ? ` · ${r.goalMet ? t.week.goalMet(r.goal) : `${cur.sessions}/${r.goal}`}` : ""}
            </Txt>
          </Col>
          <ChevronRight size={18} color={c.mutedFg} />
        </Row>
      </Card>
    </Pressable>
  );
}

const monthShort = (month: string) => dateFmt({ month: "narrow", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

/** Month-by-month sessions, and submissions against taps, over the last 12 months. */
function TrendsCard() {
  const t = useT();
  const { c } = useTheme();
  const months = useTrends().data?.months;
  if (!months) return null;
  const hasFinishes = months.some((m) => m.submissions || m.taps);
  return (
    <Card pad={false}>
      <CardHead title={t.trends.title} right={<Txt v="small" muted>{t.trends.subtitle}</Txt>} />
      <Row wrap gap={space.lg} style={{ padding: space.lg, alignItems: "flex-start" }}>
        <Col gap={8} style={{ flexGrow: 1, flexBasis: 280 }}>
          <Txt v="small" muted>{t.trends.sessions}</Txt>
          <Bars highlightLast data={months.map((m) => ({ key: m.month, label: monthShort(m.month), value: m.sessions }))} />
        </Col>
        {hasFinishes ? (
          <Col gap={8} style={{ flexGrow: 1, flexBasis: 280 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt v="small" muted>{t.trends.finishes}</Txt>
              <Row gap={10}>
                <Legend color={c.accent} label={t.trends.got} />
                <Legend color={c.mutedFg} label={t.trends.tapped} />
              </Row>
            </Row>
            <PairBars months={months} />
          </Col>
        ) : null}
      </Row>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={4}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Txt v="tiny" muted>{label}</Txt>
    </Row>
  );
}

function PairBars({ months }: { months: MonthTrend[] }) {
  const { c } = useTheme();
  const max = Math.max(1, ...months.flatMap((m) => [m.submissions, m.taps]));
  const bar = (value: number, color: string) => (
    <View style={{ flex: 1, height: `${Math.max(2, (value / max) * 85)}%`, backgroundColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
  );
  return (
    <Row gap={6} style={{ height: 140, alignItems: "flex-end" }}>
      {months.map((m) => (
        <View key={m.month} style={{ flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
          <Row gap={1} style={{ width: "100%", maxWidth: 28, height: "100%", alignItems: "flex-end" }}>
            {bar(m.submissions, c.accent)}
            {bar(m.taps, c.mutedFg)}
          </Row>
          <Txt v="tiny" muted>{monthShort(m.month)}</Txt>
        </View>
      ))}
    </Row>
  );
}
