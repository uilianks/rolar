import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ClipboardCheck from "lucide-react-native/icons/clipboard-check";
import Plus from "lucide-react-native/icons/plus";
import Trophy from "lucide-react-native/icons/trophy";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { endTime, isoWeekday, ymd } from "@/lib/format";
import { useAcademy, useCalendar } from "@/lib/queries";
import type { AcademyClass, AcademyEvent, Calendar } from "@/lib/types";
import { addMonths, EVENT_KIND_LABEL, KIND_LABEL, WEEKDAY_SHORT } from "@/shared/domain";
import { Badge, Button, Card, CardHead, ErrorText, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { radius, space, useTheme } from "@/ui/theme";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function daysIn(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

type Day = { date: string; classes: (AcademyClass & { cancelled: boolean; note: string | null; topic: string | null })[]; events: AcademyEvent[] };

/** Repeats the weekly classes over the month, applies per-date changes and places events on their local day. */
function buildMonth(month: string, cal: Calendar | undefined): Day[] {
  return Array.from({ length: daysIn(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const weekday = isoWeekday(new Date(`${date}T12:00:00`));
    const classes = (cal?.classes ?? [])
      .filter((k) => k.weekday === weekday)
      .map((k) => {
        const o = cal?.occurrences.find((x) => x.classId === k.id && x.date === date);
        return { ...k, cancelled: o?.cancelled ?? false, note: o?.note ?? null, topic: o?.topic ?? null };
      });
    const events = (cal?.events ?? []).filter((e) => ymd(new Date(e.startsAt)) === date);
    return { date, classes, events };
  });
}

/** Month view of the academy: classes, cancellations, topics taught, events and competitions. */
export default function AcademyCalendar() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { id, date: dateParam } = useLocalSearchParams<{ id: string; date?: string }>();
  const today = ymd(new Date());
  const [month, setMonth] = useState((dateParam ?? today).slice(0, 7));
  const [selected, setSelected] = useState(dateParam ?? today);
  const academy = useAcademy(id);
  const a = academy.data;
  const staff = a?.membership?.status === "active" && a.membership.role !== "student";
  const cal = useCalendar(a?.id, `${month}-01`, `${month}-${daysIn(month)}`);
  const [error, setError] = useState<unknown>(null);

  const days = buildMonth(month, cal.data);
  const lead = isoWeekday(new Date(`${month}-01T12:00:00`)) - 1;
  const day = days.find((d) => d.date === selected);

  function go(delta: number) {
    const m = addMonths(month, delta);
    setMonth(m);
    setSelected(m === today.slice(0, 7) ? today : `${m}-01`);
  }

  async function toggleCancel(k: Day["classes"][number]) {
    if (!a || !day) return;
    if (!k.cancelled && !(await confirm(`Cancelar "${k.title}" neste dia?`, "Os membros da academia recebem um aviso.", "Cancelar aula"))) return;
    setError(null);
    try {
      await api(`/academies/${a.id}/classes/${k.id}/occurrences/${day.date}`, { method: "PUT", json: { cancelled: !k.cancelled, note: k.cancelled ? undefined : "Aula cancelada" } });
      await qc.invalidateQueries({ queryKey: ["academy", a.id, "calendar"] });
    } catch (e) {
      setError(e);
    }
  }

  if (academy.isPending) return <Loading />;
  if (!a) return <ErrorText error={academy.error} />;

  return (
    <>
      <Header
        title="Calendário"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${a.id}`))} />}
        right={staff ? <Button size="sm" kind="primary" icon={Plus} title="Evento" onPress={() => router.push(`/academia/${a.id}/evento/novo`)} /> : undefined}
      />
      <Screen>
        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Button size="sm" icon={ChevronLeft} accessibilityLabel="Mês anterior" onPress={() => go(-1)} />
            <Txt v="h3">
              {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
            </Txt>
            <Button size="sm" icon={ChevronRight} accessibilityLabel="Mês seguinte" onPress={() => go(1)} />
          </Row>
          <View style={{ flexDirection: "row" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((w) => (
              <Txt key={w} v="tiny" muted style={{ flex: 1, textAlign: "center" }}>
                {WEEKDAY_SHORT[w]}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: lead }, (_, i) => (
              <View key={`lead-${i}`} style={{ width: `${100 / 7}%` }} />
            ))}
            {days.map((d) => {
              const on = d.date === selected;
              const live = d.classes.filter((k) => !k.cancelled).length;
              const cancelled = d.classes.some((k) => k.cancelled);
              const competition = d.events.some((e) => e.kind === "competition");
              return (
                <View key={d.date} style={{ width: `${100 / 7}%`, padding: 2 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Dia ${Number(d.date.slice(8))}: ${live} aulas, ${d.events.length} eventos`}
                    onPress={() => setSelected(d.date)}
                    style={{
                      height: 52,
                      borderRadius: radius.sm,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      backgroundColor: on ? c.primary : d.date === today ? c.muted : "transparent",
                    }}
                  >
                    <Txt bold={d.date === today} color={on ? c.primaryFg : undefined}>{Number(d.date.slice(8))}</Txt>
                    <Row gap={3}>
                      {live ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? c.primaryFg : c.mutedFg }} /> : null}
                      {cancelled ? <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: on ? c.primaryFg : c.mutedFg }} /> : null}
                      {d.events.length ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: competition ? c.accent : c.success }} /> : null}
                    </Row>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Row wrap gap={space.md}>
            <Legend color={c.mutedFg} label="aulas" />
            <Legend color={c.mutedFg} label="aula cancelada" hollow />
            <Legend color={c.success} label="evento" />
            <Legend color={c.accent} label="campeonato" />
          </Row>
        </Card>
        {cal.isPending ? <Loading /> : null}
        <ErrorText error={cal.error ?? error} />

        {day ? (
          <Card pad={false}>
            <CardHead title={new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })} />
            {day.events.map((e) => (
              <ListRow key={e.id} onPress={() => router.push(`/academia/${a.id}/evento/${e.id}`)}>
                {e.kind === "competition" ? <Trophy size={18} color={c.accent} /> : null}
                <View style={{ flex: 1 }}>
                  <Txt bold>{e.title}</Txt>
                  <Txt v="tiny" muted>
                    {[EVENT_KIND_LABEL[e.kind], new Date(e.startsAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }), e.location, `${e.going} vão`].filter(Boolean).join(" · ")}
                  </Txt>
                </View>
                {e.isGoing ? <Badge tone="success">Vou</Badge> : null}
              </ListRow>
            ))}
            {day.classes.map((k) => (
              <ListRow key={k.id}>
                <Txt v="small" style={{ width: 92, fontVariant: ["tabular-nums"], textDecorationLine: k.cancelled ? "line-through" : "none" }}>
                  {k.startTime}–{endTime(k.startTime, k.durationMin)}
                </Txt>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt bold style={{ textDecorationLine: k.cancelled ? "line-through" : "none" }}>{k.title}</Txt>
                  <Txt v="tiny" muted>{k.cancelled ? k.note ?? "Aula cancelada" : [KIND_LABEL[k.kind], k.topic ? `Tema: ${k.topic}` : null].filter(Boolean).join(" · ")}</Txt>
                </View>
                {k.cancelled ? <Badge tone="accent">Cancelada</Badge> : null}
                {staff && !k.cancelled && day.date <= today ? (
                  <Button size="sm" icon={ClipboardCheck} accessibilityLabel={`Chamada de ${k.title}`} onPress={() => router.push(`/academia/${a.id}/chamada?classId=${k.id}&date=${day.date}`)} />
                ) : null}
                {staff ? <Button size="sm" kind="ghost" title={k.cancelled ? "Reativar" : "Cancelar"} onPress={() => toggleCancel(k)} /> : null}
              </ListRow>
            ))}
            {!day.events.length && !day.classes.length ? (
              <View style={{ padding: space.lg }}>
                <Txt v="small" muted>Nada neste dia.</Txt>
              </View>
            ) : null}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <Row gap={6}>
      <View style={{ width: 8, height: 8, borderRadius: 4, ...(hollow ? { borderWidth: 1, borderColor: color } : { backgroundColor: color }) }} />
      <Txt v="tiny" muted>{label}</Txt>
    </Row>
  );
}
