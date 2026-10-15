import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Printer from "lucide-react-native/icons/printer";
import QrCode from "lucide-react-native/icons/qr-code";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { endTime, lastWeekday, whenLong, ymd } from "@/lib/format";
import { TZ } from "@/lib/queries";
import type { AttendanceSheet } from "@/lib/types";
import { WEEKDAY_LABEL } from "@/shared/domain";
import { Avatar, Belt, Button, Card, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { AcademyQr } from "@/ui/academy-qr";
import { Header, Screen } from "@/ui/shell";
import { radius, space, useTheme } from "@/ui/theme";

const ROLE_LABEL = { owner: "Responsável", coach: "Professor", student: "" } as const;
const DAY = 86_400_000;

/** Roll call for one class on one date: staff tick who was on the mat. */
export default function RollCall() {
  const { id, classId, date: dateParam, weekday, qr } = useLocalSearchParams<{ id: string; classId: string; date?: string; weekday?: string; qr?: string }>();
  const [date, setDate] = useState(dateParam ?? ymd(lastWeekday(Number(weekday) || 1)));
  const sheet = useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: () => api<AttendanceSheet>(`/academies/${id}/classes/${classId}/attendance?date=${date}&tz=${encodeURIComponent(TZ)}`),
  });

  const today = ymd(new Date());
  const oldest = addWeeks(today, -8); // the API accepts the last 60 days
  const k = sheet.data?.class;

  return (
    <>
      <Header
        title="Chamada"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
      />
      <Screen>
        <Card style={{ gap: space.sm }}>
          <Txt v="h2">{k ? k.title : " "}</Txt>
          {k ? <Txt v="small" muted>{WEEKDAY_LABEL[k.weekday]} · {k.startTime}–{endTime(k.startTime, k.durationMin)}</Txt> : null}
          <Row style={{ justifyContent: "space-between" }}>
            <Button size="sm" icon={ChevronLeft} accessibilityLabel="Semana anterior" disabled={addWeeks(date, -1) < oldest} onPress={() => setDate(addWeeks(date, -1))} />
            <Txt bold>{date === today ? "Hoje" : whenLong(`${date}T12:00:00`).split(" às ")[0]}</Txt>
            <Button size="sm" icon={ChevronRight} accessibilityLabel="Semana seguinte" disabled={addWeeks(date, 1) > today} onPress={() => setDate(addWeeks(date, 1))} />
          </Row>
        </Card>
        {date === today ? <CheckinQr academyId={id} startOpen={qr === "1"} /> : null}
        {sheet.isPending ? <Loading /> : null}
        <ErrorText error={sheet.error} />
        {sheet.data ? <Sheet key={`${classId}/${date}`} academyId={id} classId={classId} sheet={sheet.data} /> : null}
      </Screen>
    </>
  );
}

/** The academy's check-in QR, on screen during the class (the same one that can be printed for the entrance). */
function CheckinQr({ academyId, startOpen }: { academyId: string; startOpen: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(startOpen);
  if (!open) return <Button icon={QrCode} title="Mostrar QR de check-in" onPress={() => setOpen(true)} style={{ alignSelf: "flex-start" }} />;
  return (
    <Card style={{ alignItems: "center", gap: space.md }}>
      <Txt v="h3">Check-in da academia</Txt>
      <Txt v="small" muted style={{ textAlign: "center" }}>
        O aluno toca em Check-in na barra do app e aponta para o QR. O check-in aparece na lista abaixo para você confirmar.
      </Txt>
      <AcademyQr academyId={academyId} size={240} />
      <Txt v="tiny" color={c.mutedFg}>É o mesmo QR para todas as aulas: imprima e deixe na entrada.</Txt>
      <Row gap={space.sm}>
        <Button size="sm" icon={Printer} title="Versão para imprimir" onPress={() => router.push(`/academia/${academyId}/qr`)} />
        <Button size="sm" kind="ghost" title="Esconder" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

function addWeeks(date: string, weeks: number) {
  return ymd(new Date(new Date(`${date}T12:00:00`).getTime() + weeks * 7 * DAY));
}

function Sheet({ academyId, classId, sheet }: { academyId: string; classId: string; sheet: AttendanceSheet }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [present, setPresent] = useState(() => new Set(sheet.members.filter((m) => m.present).map((m) => m.id)));
  const [topic, setTopic] = useState(sheet.topic ?? "");
  const [q, setQ] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (userId: string) => {
    const next = new Set(present);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setPresent(next);
    setSaved(false);
  };
  const shown = sheet.members.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));
  const changed = sheet.members.some((m) => m.present !== present.has(m.id)) || topic.trim() !== (sheet.topic ?? "");
  const selfReported = sheet.members.filter((m) => (m.logged || m.checkedIn) && !present.has(m.id));

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api(`/academies/${academyId}/classes/${classId}/attendance`, { method: "PUT", json: { date: sheet.date, userIds: [...present], topic: topic.trim() || undefined } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["attendance", classId, sheet.date] }), qc.invalidateQueries({ queryKey: ["academy"] })]);
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Row style={{ justifyContent: "space-between" }} wrap>
        <Txt bold>
          {present.size} de {sheet.members.length} presentes
        </Txt>
        <Row gap={space.sm}>
          <Button size="sm" kind="ghost" title="Marcar todos" onPress={() => { setPresent(new Set(sheet.members.map((m) => m.id))); setSaved(false); }} />
          <Button size="sm" kind="ghost" title="Limpar" onPress={() => { setPresent(new Set()); setSaved(false); }} />
        </Row>
      </Row>
      {selfReported.length ? (
        <Card style={{ gap: space.sm }}>
          <Txt bold>
            {selfReported.length === 1 ? "1 aluno disse" : `${selfReported.length} alunos disseram`} que veio (check-in ou treino registrado) e ainda não {selfReported.length === 1 ? "está marcado" : "estão marcados"}
          </Txt>
          <Txt v="small" muted>{selfReported.map((m) => m.name).join(", ")}</Txt>
          <Button
            size="sm"
            kind="primary"
            icon={Check}
            title="Confirmar todos"
            style={{ alignSelf: "flex-start" }}
            onPress={() => { setPresent(new Set([...present, ...selfReported.map((m) => m.id)])); setSaved(false); }}
          />
        </Card>
      ) : null}
      <Input
        label="Tema da aula"
        value={topic}
        onChangeText={(t) => { setTopic(t); setSaved(false); }}
        placeholder="Ex.: raspagem de gancho + passagem toreando"
        hint="Aparece no calendário e já vem preenchido no registro de treino de quem estava presente."
      />
      <Input value={q} onChangeText={setQ} placeholder="Procurar aluno" />
      <Card pad={false}>
        {shown.map((m) => {
          const on = present.has(m.id);
          return (
            <ListRow key={m.id} onPress={() => toggle(m.id)} highlight={on}>
              <View
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.name}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.sm,
                  borderWidth: 1.5,
                  borderColor: on ? c.primary : c.border,
                  backgroundColor: on ? c.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {on ? <Check size={16} color={c.primaryFg} strokeWidth={2.5} /> : null}
              </View>
              <Avatar name={m.name} size={32} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt bold>{m.name}</Txt>
                {ROLE_LABEL[m.role] || m.logged || m.checkedIn ? (
                  <Txt v="tiny" muted>
                    {[ROLE_LABEL[m.role], m.checkedIn ? "fez check-in" : null, m.logged ? "registrou treino nesta aula" : null].filter(Boolean).join(" · ")}
                  </Txt>
                ) : null}
              </View>
              <Belt belt={m.belt} stripes={m.stripes} />
            </ListRow>
          );
        })}
      </Card>
      <ErrorText error={error} />
      <Col gap={space.sm}>
        <Button kind="primary" size="lg" icon={Check} title="Salvar chamada" loading={busy} disabled={!changed} onPress={save} />
        {saved ? <Txt v="small" color={c.success}>Chamada salva. Quem foi marcado agora recebe um lembrete para registrar o treino.</Txt> : null}
      </Col>
    </>
  );
}
