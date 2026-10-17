import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock from "lucide-react-native/icons/clock";
import Flame from "lucide-react-native/icons/flame";
import ImageIcon from "lucide-react-native/icons/image";
import Share2 from "lucide-react-native/icons/share-2";
import Swords from "lucide-react-native/icons/swords";
import { useState } from "react";
import { Platform, Share, View } from "react-native";

import { dateFmt, duration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useWeek } from "@/lib/queries";
import { storySupported } from "@/lib/story-image";
import type { WeekReport } from "@/lib/types";
import { Button, Card, CardHead, Col, ErrorText, Kpi, Loading, Progress, Row, Txt } from "@/ui/kit";
import { FinishChips } from "@/ui/finish-list";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayMonth = (ymd: string) => dateFmt({ day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
const weekdayLetter = (ymd: string) => dateFmt({ weekday: "narrow", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));

/** "+2" / "−30min" against last week, toned up or down; nothing to compare when both are zero. */
function useDelta() {
  const t = useT();
  return (now: number, before: number, fmt: (n: number) => string = String) => {
    if (!now && !before) return {};
    const diff = now - before;
    if (!diff) return { sub: t.week.same };
    return { sub: t.week.vsLast(`${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`), subTone: diff > 0 ? ("up" as const) : ("down" as const) };
  };
}

/** Weekly report: one week against the one before; `?semana=YYYY-MM-DD` opens a past week. */
export default function WeekScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ semana?: string }>();
  const [week, setWeek] = useState<string | undefined>(params.semana);
  const query = useWeek(week);
  const r = query.data;
  const [copied, setCopied] = useState(false);

  function share(report: WeekReport) {
    const text = t.week.shareText(report.current.sessions, duration(report.current.minutes), report.current.submissions.total);
    if (Platform.OS === "web") {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
    } else void Share.share({ message: text });
  }

  const go = (to: string) => {
    setCopied(false);
    setWeek(to);
  };

  return (
    <>
      <Header
        title={t.week.title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/progresso"))} />}
        right={
          r?.current.sessions ? (
            <Row gap={4}>
              {storySupported ? (
                <Button kind="ghost" icon={ImageIcon} accessibilityLabel={t.story.create} onPress={() => router.push({ pathname: "/imagem", params: { semana: r.week } })} />
              ) : null}
              <Button kind="ghost" icon={Share2} accessibilityLabel={t.week.share} onPress={() => share(r)} />
            </Row>
          ) : undefined
        }
      />
      <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        {query.isPending ? <Loading /> : null}
        <ErrorText error={query.error} />
        {r ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Button
                kind="ghost"
                icon={ChevronLeft}
                accessibilityLabel={t.week.previous}
                disabled={!r.firstWeek || r.week <= r.firstWeek}
                onPress={() => go(addDays(r.week, -7))}
              />
              <Col gap={2} style={{ alignItems: "center" }}>
                <Txt bold>{t.week.range(dayMonth(r.week), dayMonth(addDays(r.week, 6)))}</Txt>
                {r.inProgress ? <Txt v="small" muted>{t.week.inProgress}</Txt> : null}
              </Col>
              <Button kind="ghost" icon={ChevronRight} accessibilityLabel={t.week.next} disabled={r.inProgress} onPress={() => go(addDays(r.week, 7))} />
            </Row>
            {copied ? <Txt v="small" muted style={{ textAlign: "center" }}>{t.week.copied}</Txt> : null}
            <WeekBody r={r} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

function WeekBody({ r }: { r: WeekReport }) {
  const t = useT();
  const { c } = useTheme();
  const delta = useDelta();
  const { current: cur, previous: prev } = r;
  const days = Array.from({ length: 7 }, (_, i) => addDays(r.week, i));

  return (
    <>
      <Row wrap gap={space.md}>
        <Kpi icon={CalendarCheck} label={t.profile.sessions} value={String(cur.sessions)} {...delta(cur.sessions, prev.sessions)} />
        <Kpi icon={Clock} label={t.profile.matHours} value={duration(cur.minutes)} {...delta(cur.minutes, prev.minutes, duration)} />
        <Kpi icon={Swords} label={t.session.rounds} value={String(cur.rounds)} {...delta(cur.rounds, prev.rounds)} />
      </Row>

      <Card style={{ gap: space.md }}>
        {r.goal ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt bold>
                {r.goalMet
                  ? t.week.goalMet(r.goal)
                  : r.inProgress
                    ? t.week.goalLeft(r.goal - cur.sessions)
                    : t.week.goalMissed(cur.sessions, r.goal)}
              </Txt>
              <Txt v="small" muted>{cur.sessions}/{r.goal}</Txt>
            </Row>
            <Progress value={cur.sessions / r.goal} color={r.goalMet ? c.success : undefined} />
            {r.streakWeeks ? (
              <Row gap={6}>
                <Flame size={14} color={c.accent} />
                <Txt v="small">{t.week.streak(r.streakWeeks)}</Txt>
              </Row>
            ) : null}
          </>
        ) : (
          <Txt v="small" muted>{t.week.noGoal}</Txt>
        )}
        <Col gap={6}>
          <Txt v="small" muted>{t.week.days}</Txt>
          <Row gap={6}>
            {days.map((d) => {
              const on = cur.days.includes(d);
              return (
                <View key={d} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <View style={{ width: "100%", maxWidth: 40, height: 28, borderRadius: 6, backgroundColor: on ? c.accent : c.muted }} />
                  <Txt v="tiny" muted>{weekdayLetter(d)}</Txt>
                </View>
              );
            })}
          </Row>
        </Col>
      </Card>

      {cur.sessions ? (
        <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
          <Card pad={false} style={{ flexGrow: 1, flexBasis: 260 }}>
            <CardHead title={t.week.kinds} />
            <Col gap={8} style={{ padding: space.lg }}>
              {cur.byKind.map((k) => (
                <Row key={k.kind} style={{ justifyContent: "space-between" }}>
                  <Txt>{t.sessionKind[k.kind]}</Txt>
                  <Txt bold>{k.sessions}</Txt>
                </Row>
              ))}
            </Col>
          </Card>
          {cur.topTechniques.length ? (
            <Card pad={false} style={{ flexGrow: 1, flexBasis: 260 }}>
              <CardHead title={t.week.topTechniques} />
              <Col gap={8} style={{ padding: space.lg }}>
                {cur.topTechniques.map((k) => (
                  <Row key={k.name} style={{ justifyContent: "space-between" }}>
                    <Txt>{k.name}</Txt>
                    <Txt bold>{k.count}×</Txt>
                  </Row>
                ))}
              </Col>
            </Card>
          ) : null}
          {cur.submissions.total || cur.taps.total ? (
            <Card pad={false} style={{ flexGrow: 1, flexBasis: 260 }}>
              <CardHead title={t.finishes.title} right={<Txt v="small" muted>{t.finishes.ratio(cur.submissions.total, cur.taps.total)}</Txt>} />
              <Col style={{ padding: space.lg }}>
                <FinishChips items={cur.submissions.top} tone="got" />
                <FinishChips items={cur.taps.top} tone="tapped" />
              </Col>
            </Card>
          ) : null}
        </Row>
      ) : (
        <Card>
          <Txt v="small" muted>{t.week.empty}</Txt>
        </Card>
      )}
    </>
  );
}
