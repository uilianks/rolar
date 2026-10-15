import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useState } from "react";

import { api } from "@/lib/api";
import { ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { EventDetail } from "@/lib/types";
import { EVENT_KINDS, eventInput, type EventKind } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Button, Card, Col, ErrorText, Input, Loading, Row, Segmented, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Staff publish (or, with ?eventId=, edit) an event; members are notified when it is published. */
export default function EventFormScreen() {
  const { id, eventId, kind } = useLocalSearchParams<{ id: string; eventId?: string; kind?: string }>();
  const existing = useQuery({ queryKey: ["event", eventId], queryFn: () => api<EventDetail>(`/academies/${id}/events/${eventId}`), enabled: !!eventId });
  if (eventId && existing.isPending) return <Loading />;
  return <EventForm academyId={id} existing={existing.data} initialKind={(EVENT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as EventKind) : "competition"} />;
}

function EventForm({ academyId, existing, initialKind }: { academyId: string; existing?: EventDetail; initialKind: EventKind }) {
  const t = useT();
  const qc = useQueryClient();
  const start = existing ? new Date(existing.startsAt) : null;
  const end = existing?.endsAt ? new Date(existing.endsAt) : null;
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? initialKind);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(start ? ymd(start) : "");
  const [time, setTime] = useState(start ? hhmm(start) : "09:00");
  const [endDate, setEndDate] = useState(end ? ymd(end) : "");
  const [endTimeText, setEndTimeText] = useState(end ? hhmm(end) : "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [signupUntil, setSignupUntil] = useState(existing?.signupUntil ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const competition = kind === "competition";

  async function save() {
    setError(null);
    const startsAt = new Date(`${date}T${time}:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(startsAt.getTime())) return setError(t.eventForm.invalidStart);
    let endsAt: string | undefined;
    if (endDate || endTimeText) {
      const e = new Date(`${endDate || date}T${endTimeText || "23:59"}:00`);
      if (Number.isNaN(e.getTime())) return setError(t.eventForm.invalidEnd);
      endsAt = e.toISOString();
    }
    const check = eventInput.safeParse({ kind, title, startsAt: startsAt.toISOString(), endsAt, location, url, signupUntil, description });
    if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    setBusy(true);
    try {
      const r = await api<{ id: string }>(existing ? `/academies/${academyId}/events/${existing.id}` : `/academies/${academyId}/events`, {
        method: existing ? "PUT" : "POST",
        json: check.data,
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ["academy", academyId] }), qc.invalidateQueries({ queryKey: ["event", r.id] })]);
      if (existing && router.canGoBack()) router.back();
      else router.replace(`/academia/${academyId}/evento/${r.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title={existing ? t.eventForm.editTitle : t.academyCards.newEvent}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${academyId}`))} />}
      />
      <Screen>
        <Card style={{ gap: space.md }}>
          <Segmented label={t.eventForm.kind} value={kind} onChange={setKind} options={EVENT_KINDS.map((k) => ({ value: k, label: t.eventKind[k] }))} />
          <Input label={t.newAcademy.name} value={title} onChangeText={setTitle} placeholder={competition ? t.eventForm.titleCompetition : t.eventForm.titleOther} />
          <Row gap={space.md} wrap>
            <Col style={{ flex: 2, minWidth: 150 }}>
              <Input label={t.eventForm.date} value={date} onChangeText={setDate} placeholder="2026-11-21" maxLength={10} />
            </Col>
            <Col style={{ flex: 1, minWidth: 100 }}>
              <Input label={t.eventForm.time} value={time} onChangeText={setTime} placeholder="09:00" maxLength={5} />
            </Col>
          </Row>
          <Row gap={space.md} wrap>
            <Col style={{ flex: 2, minWidth: 150 }}>
              <Input label={t.eventForm.endDate} value={endDate} onChangeText={setEndDate} placeholder="2026-11-22" maxLength={10} />
            </Col>
            <Col style={{ flex: 1, minWidth: 100 }}>
              <Input label={t.eventForm.endTime} value={endTimeText} onChangeText={setEndTimeText} placeholder="18:00" maxLength={5} />
            </Col>
          </Row>
          <Input label={t.academy.location} value={location} onChangeText={setLocation} placeholder={competition ? t.eventForm.locationCompetition : t.eventForm.locationOther} />
          <Input
            label={competition ? t.eventForm.linkCompetition : t.eventForm.link}
            value={url}
            onChangeText={setUrl}
            placeholder="https://smoothcomp.com/en/event/…"
            autoCapitalize="none"
            keyboardType="url"
            hint={competition ? t.eventForm.linkHint : undefined}
          />
          <Input
            label={competition ? t.eventForm.signupCompetition : t.eventForm.signupOther}
            value={signupUntil}
            onChangeText={setSignupUntil}
            placeholder="2026-11-14"
            maxLength={10}
            hint={t.eventForm.signupHint}
          />
          <Input label={t.eventForm.description} value={description} onChangeText={setDescription} multiline placeholder={competition ? t.eventForm.descriptionCompetition : t.eventForm.descriptionOther} />
          <ErrorText error={error} />
          <Button kind="primary" size="lg" title={existing ? t.eventForm.saveChanges : t.eventForm.publish} loading={busy} onPress={save} />
          {!existing ? <Txt v="small" muted>{t.academyCards.everyoneNotified}</Txt> : null}
        </Card>
      </Screen>
    </>
  );
}
