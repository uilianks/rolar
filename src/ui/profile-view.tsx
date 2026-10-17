// Profile page shared by "/perfil" (own) and "/u/[username]" (others).
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import BadgeCheck from "lucide-react-native/icons/badge-check";
import Ban from "lucide-react-native/icons/ban";
import Flag from "lucide-react-native/icons/flag";
import Plus from "lucide-react-native/icons/plus";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { hours } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useMe, useProfile, useStats, useUserSessions } from "@/lib/queries";
import { beltOptions, type Belt as BeltName } from "@/shared/domain";
import type { Messages } from "@/shared/i18n";

import { DateField } from "./date-field";
import { RecentAchievements } from "./achievements";
import { Avatar, Belt, Button, Card, CardHead, Col, ErrorText, Heatmap, Kpi, Loading, Row, Segmented, Txt } from "./kit";
import { SessionCardView } from "./session-card";
import { BELT_COLORS, space, useTheme } from "./theme";

function years(t: Messages, startedAt: string | null) {
  if (!startedAt) return null;
  const [y, m] = startedAt.split("-").map(Number);
  const now = new Date();
  const total = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return total >= 12 ? t.profile.years(Math.floor(total / 12)) : t.profile.months(Math.max(total, 0));
}

function PromotionForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const me = useMe().data;
  const qc = useQueryClient();
  const [belt, setBelt] = useState<BeltName>(me?.profile?.belt ?? "white");
  const [stripes, setStripes] = useState(me?.profile?.stripes ?? 0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<unknown>(null);
  const academyId = me?.profile?.homeAcademyId ?? null;

  async function save() {
    try {
      await api("/promotions", { method: "POST", json: { belt, stripes, promotedOn: date, academyId } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
      onDone();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Col style={{ padding: space.lg }}>
      <Segmented label={t.profile.belt} value={belt} onChange={setBelt} options={beltOptions(me?.profile?.birthYear, belt).map((b) => ({ value: b, label: t.belt[b] }))} />
      <Segmented label={t.profile.stripes} value={stripes} onChange={setStripes} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
      <DateField label={t.profile.dateField} value={date} onChange={setDate} />
      <Txt v="small" muted>{academyId ? t.profile.promotionToCoach : t.profile.promotionNoAcademy}</Txt>
      <ErrorText error={error} />
      <Row>
        <Button kind="primary" title={t.profile.savePromotion} onPress={save} />
        <Button kind="ghost" title={t.common.cancel} onPress={onDone} />
      </Row>
    </Col>
  );
}

export function ProfileView({ username }: { username: string }) {
  const { c } = useTheme();
  const t = useT();
  const qc = useQueryClient();
  const me = useMe().data;
  const profile = useProfile(username);
  const sessions = useUserSessions(username);
  const p = profile.data;
  const own = p?.id === me?.user.id;
  const stats = useStats("all");
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function act(path: string, method: "POST" | "DELETE") {
    try {
      await api(path, { method });
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile", username] }), qc.invalidateQueries({ queryKey: ["feed"] })]);
    } catch (e) {
      setError(e);
    }
  }

  async function block() {
    if (!p || !(await confirm(t.profile.blockTitle(p.name), t.profile.blockText, t.profile.block))) return;
    await act(`/users/${p.id}/block`, "POST");
    router.replace("/");
  }

  async function report() {
    if (!p || !(await confirm(t.profile.reportTitle(p.name), t.profile.reportText, t.profile.report))) return;
    await api("/reports", { method: "POST", json: { targetType: "user", targetId: p.id, reason: t.profile.reportReason } });
  }

  if (profile.isPending) return <Loading />;
  if (!p) return <ErrorText error={profile.error} />;

  const items = sessions.data?.pages.flatMap((pg) => pg.items) ?? [];
  const started = years(t, p.startedAt);

  return (
    <>
      <Card pad={false}>
        <View style={{ height: 84, backgroundColor: p.belt === "white" ? c.muted : BELT_COLORS[p.belt] }} />
        <Col style={{ padding: space.lg, marginTop: -52 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <View style={{ borderWidth: 4, borderColor: c.card, borderRadius: 40 }}>
              <Avatar uri={p.avatarUrl} name={p.name} size={72} />
            </View>
            {own ? (
              <Button size="sm" title={t.profile.edit} onPress={() => router.push("/config")} />
            ) : p.isFollowing ? (
              <Button size="sm" title={t.profile.followingButton} onPress={() => act(`/users/${p.id}/follow`, "DELETE")} />
            ) : p.canFollow ? (
              <Button size="sm" kind="primary" icon={UserPlus} title={t.profile.follow} onPress={() => act(`/users/${p.id}/follow`, "POST")} />
            ) : null}
          </Row>
          <View>
            <Txt v="h1">{p.name}</Txt>
            <Txt v="small" muted>
              @{p.username}
              {p.homeAcademy ? ` · ${p.homeAcademy.name}` : ""}
            </Txt>
          </View>
          <Row gap={12} wrap>
            <Belt belt={p.belt} stripes={p.stripes} size="lg" />
            <Txt v="small">
              <Txt v="small" bold>{t.belt[p.belt]}{p.stripes ? `, ${t.profile.stripeCount(p.stripes)}` : ""}</Txt>
            </Txt>
          </Row>
          <Row gap={16} wrap>
            <Txt v="small"><Txt v="small" bold>{p.followers}</Txt> <Txt v="small" muted>{t.profile.followers}</Txt></Txt>
            <Txt v="small"><Txt v="small" bold>{p.following}</Txt> <Txt v="small" muted>{t.profile.following}</Txt></Txt>
            {started ? <Txt v="small"><Txt v="small" bold>{started}</Txt> <Txt v="small" muted>{t.profile.ofJiuJitsu}</Txt></Txt> : null}
          </Row>
          <ErrorText error={error} />
          {!own ? (
            <Row>
              <Button kind="ghost" size="sm" icon={Ban} title={t.profile.block} onPress={block} />
              <Button kind="ghost" size="sm" icon={Flag} title={t.profile.report} onPress={report} />
            </Row>
          ) : null}
        </Col>
      </Card>

      {own && stats.data ? (
        <>
          <Row wrap gap={space.md}>
            <Kpi label={t.profile.totalSessions} value={String(stats.data.totals.sessions)} />
            <Kpi label={t.profile.matHours} value={hours(stats.data.totals.minutes)} />
            <Kpi label={t.profile.thisWeek} value={String(stats.data.thisWeek.sessions)} />
          </Row>
          <Card pad={false}>
            <CardHead title={t.profile.matDays} />
            <View style={{ padding: space.lg }}>
              <Heatmap days={stats.data.days} />
            </View>
          </Card>
        </>
      ) : null}

      {own ? <RecentAchievements /> : null}

      <Card pad={false}>
        <CardHead title={t.profile.promotions} right={own && !promoting ? <Button size="sm" icon={Plus} title={t.profile.add} onPress={() => setPromoting(true)} /> : null} />
        {promoting ? <PromotionForm onDone={() => setPromoting(false)} /> : null}
        <View style={{ padding: space.lg, gap: 14 }}>
          {p.promotions.length === 0 ? <Txt v="small" muted>{t.profile.noPromotions}</Txt> : null}
          {p.promotions.map((g) => (
            <Row key={g.id} gap={12} style={{ alignItems: "flex-start" }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 3, borderWidth: 2, borderStyle: g.confirmedBy ? "solid" : "dashed", borderColor: g.confirmedBy ? c.fg : c.mutedFg }} />
              <Col gap={4} style={{ flex: 1 }}>
                <Row wrap>
                  <Belt belt={g.belt} stripes={g.stripes} />
                  <Txt bold>{t.belt[g.belt]}{g.stripes ? ` · ${t.profile.nthStripe(g.stripes)}` : ""}</Txt>
                </Row>
                <Row gap={4}>
                  {g.confirmedBy ? <BadgeCheck size={13} color={c.success} /> : null}
                  <Txt v="small" muted>
                    {g.promotedOn.split("-").reverse().join("/")} · {g.confirmedBy ? t.profile.confirmed : g.academyId ? t.profile.awaitingCoach : t.profile.selfReported}
                  </Txt>
                </Row>
              </Col>
            </Row>
          ))}
        </View>
      </Card>

      <Txt v="h3">{t.profile.sessions}</Txt>
      {items.map((s) => (
        <SessionCardView key={s.id} s={s} />
      ))}
      {items.length === 0 && !sessions.isPending ? <Txt v="small" muted>{t.profile.noSessions}</Txt> : null}
      {sessions.hasNextPage ? <Button title={t.common.loadMore} onPress={() => sessions.fetchNextPage()} /> : null}
    </>
  );
}
