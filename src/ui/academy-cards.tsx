// Cards of the academy page that each own one feature: notice board, events, medals, missing students, own fee.
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Pin from "lucide-react-native/icons/pin";
import Plus from "lucide-react-native/icons/plus";
import Trash from "lucide-react-native/icons/trash";
import Trophy from "lucide-react-native/icons/trophy";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { ago, euros, monthYear, whenLong } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAnnouncements, useEvents, useInactive, useMedals, useMyBilling } from "@/lib/queries";

import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Row, Txt } from "./kit";
import { space, useTheme } from "./theme";

const half = { flexGrow: 1, flexBasis: 320 } as const;

/** Members-only notices; staff post (optionally pinned) and everyone is notified. */
export function NoticeBoard({ academyId, staff }: { academyId: string; staff: boolean }) {
  const { c } = useTheme();
  const t = useT();
  const qc = useQueryClient();
  const list = useAnnouncements(academyId, true);
  const [body, setBody] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["academy", academyId, "announcements"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!staff && !list.data?.length) return null;
  return (
    <Card pad={false}>
      <CardHead title={t.academyCards.board} />
      {staff ? (
        <Col style={{ padding: space.lg, gap: space.sm }}>
          <Input value={body} onChangeText={setBody} multiline placeholder={t.academyCards.boardPlaceholder} />
          <ErrorText error={error} />
          <Row gap={space.sm} wrap>
            <Button size="sm" kind="primary" title={t.academyCards.publish} loading={busy} disabled={body.trim().length < 2} onPress={() => run(async () => { await api(`/academies/${academyId}/announcements`, { method: "POST", json: { body } }); setBody(""); })} />
            <Button size="sm" icon={Pin} title={t.academyCards.publishPinned} disabled={busy || body.trim().length < 2} onPress={() => run(async () => { await api(`/academies/${academyId}/announcements`, { method: "POST", json: { body, pinned: true } }); setBody(""); })} />
          </Row>
          <Txt v="tiny" muted>{t.academyCards.everyoneNotified}</Txt>
        </Col>
      ) : null}
      {(list.data ?? []).map((n) => (
        <ListRow key={n.id}>
          <Avatar uri={n.author?.avatarUrl} name={n.author?.name ?? "?"} size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt>{n.body}</Txt>
            <Txt v="tiny" muted>
              {[n.pinned ? t.academyCards.pinned : null, n.author?.name, ago(n.createdAt)].filter(Boolean).join(" · ")}
            </Txt>
          </View>
          {staff ? (
            <Row gap={2}>
              <Button size="sm" kind="ghost" icon={Pin} accessibilityLabel={n.pinned ? t.academyCards.unpin : t.academyCards.pin} onPress={() => run(() => api(`/academies/${academyId}/announcements/${n.id}`, { method: "PATCH", json: { pinned: !n.pinned } }))} />
              <Button
                size="sm"
                kind="ghost"
                icon={Trash}
                accessibilityLabel={t.academyCards.deleteNotice}
                onPress={async () => {
                  if (await confirm(t.academyCards.deleteNoticeTitle, t.academyCards.deleteNoticeText, t.academyCards.deleteAction)) void run(() => api(`/academies/${academyId}/announcements/${n.id}`, { method: "DELETE" }));
                }}
              />
            </Row>
          ) : null}
        </ListRow>
      ))}
      {staff && list.data?.length === 0 ? (
        <View style={{ padding: space.lg, paddingTop: 0 }}>
          <Txt v="small" color={c.mutedFg}>{t.academyCards.noNotices}</Txt>
        </View>
      ) : null}
    </Card>
  );
}

/** Next events and competitions, with the calendar one tap away. */
export function UpcomingEvents({ academyId, staff }: { academyId: string; staff: boolean }) {
  const { c } = useTheme();
  const t = useT();
  const events = useEvents(academyId);
  return (
    <Card pad={false} style={half}>
      <CardHead
        title={t.academyCards.upcoming}
        right={
          <Row gap={4}>
            <Button size="sm" kind="ghost" icon={CalendarDays} title={t.academyCards.calendar} onPress={() => router.push(`/academia/${academyId}/calendario`)} />
            {staff ? <Button size="sm" kind="ghost" icon={Plus} accessibilityLabel={t.academyCards.newEvent} onPress={() => router.push(`/academia/${academyId}/evento/novo`)} /> : null}
          </Row>
        }
      />
      {(events.data ?? []).slice(0, 5).map((e) => (
        <ListRow key={e.id} onPress={() => router.push(`/academia/${academyId}/evento/${e.id}`)}>
          {e.kind === "competition" ? <Trophy size={18} color={c.accent} /> : <CalendarDays size={18} color={c.fg} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt bold>{e.title}</Txt>
            <Txt v="tiny" muted>{[t.eventKind[e.kind], whenLong(e.startsAt), e.kind === "competition" ? t.academyCards.competing(e.going) : t.academyCards.going(e.going)].join(" · ")}</Txt>
          </View>
          {e.isGoing ? <Badge tone="success">{t.academyCards.imGoing}</Badge> : null}
        </ListRow>
      ))}
      {events.data?.length === 0 ? (
        <View style={{ padding: space.lg }}>
          <Txt v="small" muted>{staff ? t.academyCards.noEventsStaff : t.academyCards.noEvents}</Txt>
        </View>
      ) : null}
    </Card>
  );
}

/** The academy's medal table for the year. Hidden until someone medals. */
export function MedalTable({ academyId }: { academyId: string }) {
  const t = useT();
  const medals = useMedals(academyId);
  const m = medals.data;
  if (!m?.athletes.length) return null;
  return (
    <Card pad={false} style={half}>
      <CardHead title={t.academyCards.medals(m.year)} right={<Txt bold>🥇 {m.total.gold}  🥈 {m.total.silver}  🥉 {m.total.bronze}</Txt>} />
      {m.athletes.slice(0, 8).map((x) => (
        <ListRow key={x.id} onPress={() => router.push(`/u/${x.username}`)}>
          <Avatar uri={x.avatarUrl} name={x.name} size={28} />
          <Txt bold style={{ flex: 1 }}>{x.name}</Txt>
          <Txt>
            {x.gold ? `🥇${x.gold} ` : ""}
            {x.silver ? `🥈${x.silver} ` : ""}
            {x.bronze ? `🥉${x.bronze}` : ""}
          </Txt>
        </ListRow>
      ))}
    </Card>
  );
}

/** Staff: students who have not been seen for two weeks, oldest absence first. */
export function MissingStudents({ academyId }: { academyId: string }) {
  const t = useT();
  const inactive = useInactive(academyId, true);
  const list = inactive.data?.members ?? [];
  if (!list.length) return null;
  return (
    <Card pad={false} style={half}>
      <CardHead title={t.academyCards.missing} right={<Badge tone="accent">{t.academyCards.missingBadge(list.length, inactive.data!.days)}</Badge>} />
      {list.slice(0, 8).map((m) => (
        <ListRow key={m.id} onPress={() => router.push(`/u/${m.username}`)}>
          <Avatar uri={m.avatarUrl} name={m.name} size={28} />
          <View style={{ flex: 1 }}>
            <Txt bold>{m.name}</Txt>
            <Txt v="tiny" muted>{m.lastSeen ? t.academyCards.lastSeen(ago(`${m.lastSeen}T12:00:00`)) : t.academyCards.neverSeen}</Txt>
          </View>
          <Belt belt={m.belt} stripes={m.stripes} />
        </ListRow>
      ))}
      <View style={{ padding: space.md }}>
        <Txt v="tiny" muted>{t.academyCards.missingHint}</Txt>
      </View>
    </Card>
  );
}

/** The member's own fee status; only shown when the owner put them on a plan. */
export function MyFee({ academyId }: { academyId: string }) {
  const { c } = useTheme();
  const t = useT();
  const fee = useMyBilling(academyId, true).data;
  if (!fee?.plan) return null;
  const tone = fee.status === "late" ? c.accent : fee.status === "paid" ? c.success : c.fg;
  return (
    <Card style={{ gap: 4 }}>
      <Row style={{ justifyContent: "space-between" }} wrap>
        <Txt bold>{t.academyCards.fee(fee.plan.name)}</Txt>
        <Txt bold color={tone}>
          {t.billingStatus[fee.status]}
          {fee.status === "late" ? ` · ${t.academyCards.months(fee.lateMonths)}` : ""}
        </Txt>
      </Row>
      <Txt v="small" muted>
        {fee.plan.priceCents ? `${euros(fee.plan.priceCents)} · ${t.academyCards.dueDay(fee.billingDueDay)}` : t.billingStatus.exempt}
        {fee.paidThrough ? ` · ${t.academyCards.paidThrough(monthYear(fee.paidThrough))}` : ""}
      </Txt>
      {fee.status === "late" || fee.status === "due" ? <Txt v="small" muted>{t.academyCards.payAtDesk}</Txt> : null}
    </Card>
  );
}
