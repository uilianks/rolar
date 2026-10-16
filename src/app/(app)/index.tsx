import { router } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import BookOpen from "lucide-react-native/icons/book-open";
import Clock from "lucide-react-native/icons/clock";
import Expand from "lucide-react-native/icons/expand";
import Newspaper from "lucide-react-native/icons/newspaper";
import Plus from "lucide-react-native/icons/plus";
import Timer from "lucide-react-native/icons/timer";
import { View } from "react-native";

import { duration, hours } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useFeed, useKnownTechniques, useMe, useStats } from "@/lib/queries";
import { ClassNowCard } from "@/ui/checkin-card";
import { Button, Card, CardHead, Col, Empty, ErrorText, Kpi, Loading, Progress, Row, Txt } from "@/ui/kit";
import { SessionRow } from "@/ui/session-card";
import { BrandMark, Header, Screen, useWide } from "@/ui/shell";
import { TechniqueGraphView } from "@/ui/technique-graph";
import { space, useTheme } from "@/ui/theme";

function WeekSummary() {
  const t = useT();
  const { c } = useTheme();
  const stats = useStats().data;
  if (!stats) return null;
  const { thisWeek, streakWeeks } = stats;
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const days = t.feed.dayLetters.map((letter, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { letter, trained: thisWeek.days.includes(key), isToday: d.toDateString() === today.toDateString() };
  });
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h3">{t.feed.yourWeek}</Txt>
        <Txt v="small" muted onPress={() => router.navigate("/progresso")}>{t.feed.seeProgress}</Txt>
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        {days.map((d, i) => (
          <Col key={i} gap={4} style={{ alignItems: "center", flex: 1 }}>
            <Txt v="tiny" muted>{d.letter}</Txt>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: d.trained ? c.accent : c.muted,
                borderWidth: d.isToday ? 2 : 1,
                borderColor: d.isToday ? c.fg : c.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {d.trained ? <Txt v="small" color="#fff" bold>✓</Txt> : null}
            </View>
          </Col>
        ))}
      </Row>
      <Row wrap style={{ justifyContent: "space-between" }}>
        <Txt v="small">
          {thisWeek.goal ? t.feed.ofGoal(thisWeek.sessions, thisWeek.goal) : t.feed.sessions(thisWeek.sessions)}
        </Txt>
        <Txt v="small" muted>
          {t.feed.onTheMat(duration(thisWeek.minutes))}{streakWeeks > 1 ? ` · ${t.feed.streak(streakWeeks)}` : ""}
        </Txt>
      </Row>
      {thisWeek.goal ? <Progress value={thisWeek.sessions / thisWeek.goal} /> : null}
    </Card>
  );
}

/** The athlete's own technique map: what they marked as known or logged in their sessions. */
function KnownTechniques() {
  const t = useT();
  const known = useKnownTechniques();
  const count = known.data?.nodes.length ?? 0;
  return (
    <Card pad={false}>
      <CardHead
        title={t.home.techniques}
        right={
          <Row gap={4}>
            {count ? <Txt v="small" muted>{t.home.knownCount(count)}</Txt> : null}
            {count ? <Button size="sm" kind="ghost" icon={Expand} accessibilityLabel={t.home.openMap} onPress={() => router.push("/tecnicas/mapa")} /> : null}
            <Button size="sm" kind="primary" icon={Plus} accessibilityLabel={t.home.addTechniques} onPress={() => router.push("/tecnicas")} />
          </Row>
        }
      />
      {known.isPending ? <Loading /> : null}
      <ErrorText error={known.error} />
      {count ? (
        <View style={{ height: 340 }}>
          <TechniqueGraphView graph={known.data!} wheel={false} onOpen={(id) => router.push(`/tecnicas/${id}`)} />
        </View>
      ) : null}
      {known.data && !count ? (
        <Empty icon={BookOpen} title={t.home.noTechniques} text={t.home.noTechniquesText} action={<Button size="sm" title={t.home.browseCatalog} onPress={() => router.push("/tecnicas")} />} />
      ) : null}
    </Card>
  );
}

/** Home: the athlete's own training first; the social feed lives at /feed. */
export default function Home() {
  const t = useT();
  const wide = useWide();
  const me = useMe().data;
  const stats = useStats();
  const recent = useFeed("me");
  const s = stats.data;
  const sessions = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const unread = me?.unreadNotifications ?? 0;

  return (
    <>
      <Header
        title={t.nav.home}
        left={wide ? undefined : <BrandMark />}
        right={
          <Row gap={4}>
            {/* On phones the dock's centre is check-in, so logging a session lives here. */}
            {wide ? null : <Button kind="primary" size="sm" icon={Plus} accessibilityLabel={t.nav.logSession} onPress={() => router.push("/registrar")} />}
            {wide ? null : <Button kind="ghost" icon={Newspaper} accessibilityLabel={t.nav.feed} onPress={() => router.push("/feed")} />}
            {wide ? null : <Button kind="ghost" icon={Timer} accessibilityLabel={t.nav.timer} onPress={() => router.push("/timer")} />}
            {wide ? null : (
              <Button kind={unread ? "accent" : "ghost"} icon={Bell} title={unread ? String(unread) : undefined} accessibilityLabel={t.nav.notifications} onPress={() => router.push("/notificacoes")} size={unread ? "sm" : "md"} />
            )}
          </Row>
        }
      />
      <Screen onRefresh={() => Promise.all([stats.refetch(), recent.refetch()])} refreshing={stats.isRefetching || recent.isRefetching}>
        <ClassNowCard />
        <WeekSummary />
        {stats.isPending ? <Loading /> : null}
        <ErrorText error={stats.error} />
        {s ? (
          <Row wrap gap={space.md}>
            <Kpi icon={CalendarCheck} label={t.profile.sessions} value={String(s.totals.sessions)} />
            <Kpi icon={Clock} label={t.profile.matHours} value={hours(s.totals.minutes)} />
          </Row>
        ) : null}
        <KnownTechniques />
        <Card pad={false}>
          <CardHead title={t.home.recent} right={sessions.length ? <Txt v="small" muted onPress={() => router.navigate("/progresso")}>{t.home.seeAll}</Txt> : undefined} />
          {recent.isPending ? <Loading /> : null}
          {sessions.map((d) => (
            <SessionRow key={d.id} s={d} />
          ))}
          {!recent.isPending && !sessions.length ? (
            <Empty icon={Timer} title={t.home.noSessions} action={<Button size="sm" kind="primary" title={t.nav.logSession} onPress={() => router.navigate("/registrar")} />} />
          ) : null}
        </Card>
      </Screen>
    </>
  );
}
