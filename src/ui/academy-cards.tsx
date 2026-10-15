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
import { ago, whenLong } from "@/lib/format";
import { useAnnouncements, useEvents, useInactive, useMedals, useMyBilling } from "@/lib/queries";
import { BILLING_STATUS_LABEL, EVENT_KIND_LABEL, formatEuros } from "@/shared/domain";

import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Row, Txt } from "./kit";
import { space, useTheme } from "./theme";

const half = { flexGrow: 1, flexBasis: 320 } as const;

/** Members-only notices; staff post (optionally pinned) and everyone is notified. */
export function NoticeBoard({ academyId, staff }: { academyId: string; staff: boolean }) {
  const { c } = useTheme();
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
      <CardHead title="Mural de avisos" />
      {staff ? (
        <Col style={{ padding: space.lg, gap: space.sm }}>
          <Input value={body} onChangeText={setBody} multiline placeholder="Ex.: Sexta não tem aula (feriado). Sábado o open mat começa às 11h." />
          <ErrorText error={error} />
          <Row gap={space.sm} wrap>
            <Button size="sm" kind="primary" title="Publicar" loading={busy} disabled={body.trim().length < 2} onPress={() => run(async () => { await api(`/academies/${academyId}/announcements`, { method: "POST", json: { body } }); setBody(""); })} />
            <Button size="sm" icon={Pin} title="Publicar fixado" disabled={busy || body.trim().length < 2} onPress={() => run(async () => { await api(`/academies/${academyId}/announcements`, { method: "POST", json: { body, pinned: true } }); setBody(""); })} />
          </Row>
          <Txt v="tiny" muted>Todos os membros recebem uma notificação.</Txt>
        </Col>
      ) : null}
      {(list.data ?? []).map((n) => (
        <ListRow key={n.id}>
          <Avatar uri={n.author?.avatarUrl} name={n.author?.name ?? "?"} size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt>{n.body}</Txt>
            <Txt v="tiny" muted>
              {[n.pinned ? "📌 fixado" : null, n.author?.name, ago(n.createdAt)].filter(Boolean).join(" · ")}
            </Txt>
          </View>
          {staff ? (
            <Row gap={2}>
              <Button size="sm" kind="ghost" icon={Pin} accessibilityLabel={n.pinned ? "Desafixar" : "Fixar"} onPress={() => run(() => api(`/academies/${academyId}/announcements/${n.id}`, { method: "PATCH", json: { pinned: !n.pinned } }))} />
              <Button
                size="sm"
                kind="ghost"
                icon={Trash}
                accessibilityLabel="Apagar aviso"
                onPress={async () => {
                  if (await confirm("Apagar este aviso?", "Ele some do mural.", "Apagar")) void run(() => api(`/academies/${academyId}/announcements/${n.id}`, { method: "DELETE" }));
                }}
              />
            </Row>
          ) : null}
        </ListRow>
      ))}
      {staff && list.data?.length === 0 ? (
        <View style={{ padding: space.lg, paddingTop: 0 }}>
          <Txt v="small" color={c.mutedFg}>Nenhum aviso ainda.</Txt>
        </View>
      ) : null}
    </Card>
  );
}

/** Next events and competitions, with the calendar one tap away. */
export function UpcomingEvents({ academyId, staff }: { academyId: string; staff: boolean }) {
  const { c } = useTheme();
  const events = useEvents(academyId);
  return (
    <Card pad={false} style={half}>
      <CardHead
        title="Próximos eventos"
        right={
          <Row gap={4}>
            <Button size="sm" kind="ghost" icon={CalendarDays} title="Calendário" onPress={() => router.push(`/academia/${academyId}/calendario`)} />
            {staff ? <Button size="sm" kind="ghost" icon={Plus} accessibilityLabel="Novo evento" onPress={() => router.push(`/academia/${academyId}/evento/novo`)} /> : null}
          </Row>
        }
      />
      {(events.data ?? []).slice(0, 5).map((e) => (
        <ListRow key={e.id} onPress={() => router.push(`/academia/${academyId}/evento/${e.id}`)}>
          {e.kind === "competition" ? <Trophy size={18} color={c.accent} /> : <CalendarDays size={18} color={c.fg} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt bold>{e.title}</Txt>
            <Txt v="tiny" muted>{[EVENT_KIND_LABEL[e.kind], whenLong(e.startsAt), `${e.going} ${e.kind === "competition" ? "competem" : "vão"}`].join(" · ")}</Txt>
          </View>
          {e.isGoing ? <Badge tone="success">Vou</Badge> : null}
        </ListRow>
      ))}
      {events.data?.length === 0 ? (
        <View style={{ padding: space.lg }}>
          <Txt v="small" muted>{staff ? "Publique campeonatos, seminários e exames de graduação para os alunos confirmarem." : "Nenhum evento marcado."}</Txt>
        </View>
      ) : null}
    </Card>
  );
}

/** The academy's medal table for the year. Hidden until someone medals. */
export function MedalTable({ academyId }: { academyId: string }) {
  const medals = useMedals(academyId);
  const m = medals.data;
  if (!m?.athletes.length) return null;
  return (
    <Card pad={false} style={half}>
      <CardHead title={`Medalhas ${m.year}`} right={<Txt bold>🥇 {m.total.gold}  🥈 {m.total.silver}  🥉 {m.total.bronze}</Txt>} />
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
  const inactive = useInactive(academyId, true);
  const list = inactive.data?.members ?? [];
  if (!list.length) return null;
  return (
    <Card pad={false} style={half}>
      <CardHead title="Alunos sumidos" right={<Badge tone="accent">{`${list.length} · +${inactive.data!.days} dias`}</Badge>} />
      {list.slice(0, 8).map((m) => (
        <ListRow key={m.id} onPress={() => router.push(`/u/${m.username}`)}>
          <Avatar uri={m.avatarUrl} name={m.name} size={28} />
          <View style={{ flex: 1 }}>
            <Txt bold>{m.name}</Txt>
            <Txt v="tiny" muted>{m.lastSeen ? `visto pela última vez ${ago(`${m.lastSeen}T12:00:00`)}` : "nunca registrou presença"}</Txt>
          </View>
          <Belt belt={m.belt} stripes={m.stripes} />
        </ListRow>
      ))}
      <View style={{ padding: space.md }}>
        <Txt v="tiny" muted>Sem chamada, check-in ou treino registrado na academia. Uma mensagem agora costuma trazer o aluno de volta.</Txt>
      </View>
    </Card>
  );
}

/** The member's own fee status; only shown when the owner put them on a plan. */
export function MyFee({ academyId }: { academyId: string }) {
  const { c } = useTheme();
  const fee = useMyBilling(academyId, true).data;
  if (!fee?.plan) return null;
  const tone = fee.status === "late" ? c.accent : fee.status === "paid" ? c.success : c.fg;
  return (
    <Card style={{ gap: 4 }}>
      <Row style={{ justifyContent: "space-between" }} wrap>
        <Txt bold>Mensalidade · {fee.plan.name}</Txt>
        <Txt bold color={tone}>
          {BILLING_STATUS_LABEL[fee.status]}
          {fee.status === "late" ? ` · ${fee.lateMonths} ${fee.lateMonths === 1 ? "mês" : "meses"}` : ""}
        </Txt>
      </Row>
      <Txt v="small" muted>
        {fee.plan.priceCents ? `${formatEuros(fee.plan.priceCents)} · vence dia ${fee.billingDueDay}` : "Isento"}
        {fee.paidThrough ? ` · pago até ${new Date(`${fee.paidThrough}-15T12:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}` : ""}
      </Txt>
      {fee.status === "late" || fee.status === "due" ? <Txt v="small" muted>Pague na receção; o responsável registra aqui.</Txt> : null}
    </Card>
  );
}
