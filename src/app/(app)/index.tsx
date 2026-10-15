import { router } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import { useState } from "react";
import { View } from "react-native";

import { duration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useFeed, useMe, useStats } from "@/lib/queries";
import { Button, Card, Col, Empty, ErrorText, Loading, Progress, Row, Tabs, Txt } from "@/ui/kit";
import { ClassNowCard } from "@/ui/checkin-card";
import { SessionCardView } from "@/ui/session-card";
import { BrandMark, Header, Screen, useWide } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

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

export default function Feed() {
  const t = useT();
  const wide = useWide();
  const me = useMe().data;
  const [scope, setScope] = useState<"following" | "academy" | "me">("following");
  const feed = useFeed(scope);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = me?.unreadNotifications ?? 0;

  return (
    <>
      <Header
        title={t.nav.feed}
        left={wide ? undefined : <BrandMark />}
        right={
          <Row gap={4}>
            {/* On phones the dock's centre is check-in, so logging a session lives here. */}
            {wide ? null : <Button kind="primary" size="sm" icon={Plus} accessibilityLabel={t.nav.logSession} onPress={() => router.push("/registrar")} />}
            <Button kind="ghost" icon={Search} accessibilityLabel={t.search.title} onPress={() => router.push("/buscar")} />
            {wide ? null : <Button kind="ghost" icon={Timer} accessibilityLabel={t.nav.timer} onPress={() => router.push("/timer")} />}
            {wide ? null : (
              <Button kind={unread ? "accent" : "ghost"} icon={Bell} title={unread ? String(unread) : undefined} accessibilityLabel={t.nav.notifications} onPress={() => router.push("/notificacoes")} size={unread ? "sm" : "md"} />
            )}
          </Row>
        }
      />
      <Screen
        onRefresh={() => feed.refetch()}
        refreshing={feed.isRefetching}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
      >
        <ClassNowCard />
        <WeekSummary />
        <Tabs
          value={scope}
          onChange={setScope}
          options={[
            { value: "following", label: t.feed.following },
            { value: "academy", label: t.feed.myAcademy },
            { value: "me", label: t.feed.me },
          ]}
        />
        {feed.isPending ? <Loading /> : null}
        <ErrorText error={feed.error} />
        {items.map((s) => (
          <SessionCardView key={s.id} s={s} />
        ))}
        {feed.isFetchingNextPage ? <Loading /> : null}
        {!feed.isPending && items.length === 0 ? (
          scope === "academy" ? (
            <Card>
              <Empty icon={Users} title={t.feed.academyEmpty} text={t.feed.academyEmptyText} action={<Button size="sm" title={t.feed.seeAcademy} onPress={() => router.navigate("/academia")} />} />
            </Card>
          ) : (
            <Card>
              <Empty
                icon={Timer}
                title={t.feed.empty}
                text={t.feed.emptyText}
                action={
                  <Row>
                    <Button size="sm" kind="primary" title={t.nav.logSession} onPress={() => router.navigate("/registrar")} />
                    <Button size="sm" title={t.search.title} onPress={() => router.push("/buscar")} />
                  </Row>
                }
              />
            </Card>
          )
        ) : null}
      </Screen>
    </>
  );
}
