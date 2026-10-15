import { router } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import { useState } from "react";
import { View } from "react-native";

import { duration } from "@/lib/format";
import { useFeed, useMe, useStats } from "@/lib/queries";
import { Button, Card, Col, Empty, ErrorText, Loading, Progress, Row, Tabs, Txt } from "@/ui/kit";
import { ClassNowCard } from "@/ui/checkin-card";
import { SessionCardView } from "@/ui/session-card";
import { BrandMark, Header, Screen, useWide } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];

function WeekSummary() {
  const { c } = useTheme();
  const stats = useStats().data;
  if (!stats) return null;
  const { thisWeek, streakWeeks } = stats;
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const days = DAY_LETTERS.map((letter, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { letter, trained: thisWeek.days.includes(key), isToday: d.toDateString() === today.toDateString() };
  });
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h3">Sua semana</Txt>
        <Txt v="small" muted onPress={() => router.navigate("/progresso")}>Ver progresso →</Txt>
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
          {thisWeek.goal ? <><Txt v="small" bold>{thisWeek.sessions}</Txt> de <Txt v="small" bold>{thisWeek.goal}</Txt> treinos da meta</> : <><Txt v="small" bold>{thisWeek.sessions}</Txt> treinos</>}
        </Txt>
        <Txt v="small" muted>
          {duration(thisWeek.minutes)} no tatame{streakWeeks > 1 ? ` · ${streakWeeks} semanas seguidas 🔥` : ""}
        </Txt>
      </Row>
      {thisWeek.goal ? <Progress value={thisWeek.sessions / thisWeek.goal} /> : null}
    </Card>
  );
}

export default function Feed() {
  const wide = useWide();
  const me = useMe().data;
  const [scope, setScope] = useState<"following" | "academy" | "me">("following");
  const feed = useFeed(scope);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = me?.unreadNotifications ?? 0;

  return (
    <>
      <Header
        title="Feed"
        left={wide ? undefined : <BrandMark />}
        right={
          <Row gap={4}>
            {/* On phones the dock's centre is check-in, so logging a session lives here. */}
            {wide ? null : <Button kind="primary" size="sm" icon={Plus} accessibilityLabel="Registrar treino" onPress={() => router.push("/registrar")} />}
            <Button kind="ghost" icon={Search} accessibilityLabel="Buscar pessoas" onPress={() => router.push("/buscar")} />
            {wide ? null : <Button kind="ghost" icon={Timer} accessibilityLabel="Timer de rounds" onPress={() => router.push("/timer")} />}
            {wide ? null : (
              <Button kind={unread ? "accent" : "ghost"} icon={Bell} title={unread ? String(unread) : undefined} accessibilityLabel="Notificações" onPress={() => router.push("/notificacoes")} size={unread ? "sm" : "md"} />
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
            { value: "following", label: "Seguindo" },
            { value: "academy", label: "Minha academia" },
            { value: "me", label: "Eu" },
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
              <Empty icon={Users} title="Nada da sua academia ainda" text="Treinos dos colegas aparecem aqui quando estiverem visíveis para você." action={<Button size="sm" title="Ver academia" onPress={() => router.navigate("/academia")} />} />
            </Card>
          ) : (
            <Card>
              <Empty
                icon={Timer}
                title="Seu feed está vazio"
                text="Registre o seu primeiro treino ou siga colegas de tatame."
                action={
                  <Row>
                    <Button size="sm" kind="primary" title="Registrar treino" onPress={() => router.navigate("/registrar")} />
                    <Button size="sm" title="Buscar pessoas" onPress={() => router.push("/buscar")} />
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
