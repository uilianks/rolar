import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Globe from "lucide-react-native/icons/globe";
import Lock from "lucide-react-native/icons/lock";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { api } from "@/lib/api";
import { ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { TZ, useCreateSession, useMe, useSession, useUpdateSession } from "@/lib/queries";
import type { ClassWithOccurrence, SessionCard } from "@/lib/types";
import { SESSION_KINDS, sessionInput, type SessionKind, type Visibility } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { DateField } from "@/ui/date-field";
import { Button, Card, Col, ErrorText, Input, Loading, Row, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const VIS_ICON = { public: Globe, followers: Users, private: Lock };

type Params = { durationMin?: string; rounds?: string; kind?: string; source?: string; classId?: string; date?: string; sessionId?: string };

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Log a session; prefilled by the timer (duration, rounds) or by a roll call (class and date). With
 * `sessionId`, or a class the athlete already has a session for (a check-in logs one), it edits that
 * session instead of logging the class twice.
 */
export default function Register() {
  const params = useLocalSearchParams<Params>();
  const fromClass = useQuery({
    queryKey: ["class", params.classId, params.date],
    queryFn: () => api<ClassWithOccurrence>(`/classes/${params.classId}${params.date ? `?date=${params.date}&tz=${encodeURIComponent(TZ)}` : ""}`),
    enabled: !!params.classId,
  });
  const editId = params.sessionId ?? fromClass.data?.sessionId ?? undefined;
  const existing = useSession(editId ?? "");
  if ((params.classId && fromClass.isPending) || (editId && existing.isPending)) return <Loading />;
  return <RegisterForm key={existing.data?.id} params={params} fromClass={fromClass.data} existing={existing.data} />;
}

function RegisterForm({ params, fromClass, existing }: { params: Params; fromClass?: ClassWithOccurrence; existing?: SessionCard }) {
  const t = useT();
  const { c } = useTheme();
  const me = useMe().data;
  const create = useCreateSession();
  const update = useUpdateSession(existing?.id ?? "");
  const saving = create.isPending || update.isPending;
  const now = new Date();
  const activeAcademies = (me?.memberships ?? []).filter((m) => m.status === "active");
  const presetKind = existing?.kind ?? fromClass?.kind ?? params.kind;
  const started = existing ? new Date(existing.startedAt) : null;
  const topicNote = fromClass?.topic ? t.log.topicNote(fromClass.topic) : "";
  const defaultVisibility = me?.profile?.defaultVisibility ?? "followers";

  const [kind, setKind] = useState<SessionKind>((SESSION_KINDS as readonly string[]).includes(presetKind ?? "") ? (presetKind as SessionKind) : "gi");
  const [date, setDate] = useState(started ? ymd(started) : fromClass && params.date ? params.date : ymd(now));
  const [time, setTime] = useState(started ? hhmm(started) : (fromClass?.startTime ?? hhmm(now)));
  const [durationMin, setDuration] = useState(existing?.durationMin ?? fromClass?.durationMin ?? (Number(params.durationMin) || 90));
  const [rounds, setRounds] = useState(existing?.rounds ?? (Number(params.rounds) || 0));
  const [rpe, setRpe] = useState(existing?.rpe ?? 7);
  const [academyId, setAcademyId] = useState<string | null>(existing ? (existing.academy?.id ?? null) : (fromClass?.academyId ?? me?.profile?.homeAcademyId ?? null));
  const [title, setTitle] = useState(existing ? (existing.title ?? "") : (fromClass?.title ?? ""));
  const [notes, setNotes] = useState(existing?.notes ?? topicNote);
  const [techniques, setTechniques] = useState<string[]>(existing?.techniques ?? []);
  const [technique, setTechnique] = useState("");
  // A check-in session is private until filled in; filling it in publishes it like any other session.
  const [visibility, setVisibility] = useState<Visibility>(existing && !existing.reviewPending ? existing.visibility : defaultVisibility);
  const [error, setError] = useState<string | null>(null);

  function addTechnique() {
    const v = technique.trim();
    if (v && !techniques.includes(v)) setTechniques([...techniques, v]);
    setTechnique("");
  }

  async function save() {
    setError(null);
    const startedAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startedAt.getTime())) return setError(t.log.invalidDate);
    const input = sessionInput.safeParse({
      kind,
      startedAt: startedAt.toISOString(),
      durationMin,
      rounds,
      rpe,
      title: title || undefined,
      notes: notes || undefined,
      techniques,
      academyId,
      visibility,
      source: params.source === "timer" ? "timer" : "manual",
    });
    if (!input.success) return setError(validationMessage(t, input.error.issues[0].message));
    try {
      const { source: _source, ...patch } = input.data;
      const s = existing ? await update.mutateAsync(patch) : await create.mutateAsync(input.data);
      // Editing from the session page goes back to it; anything else lands on the saved session.
      if (existing && !existing.reviewPending && router.canGoBack()) router.back();
      else router.replace(`/treino/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Header
        title={existing?.reviewPending ? t.review.title : existing ? t.log.editTitle : t.nav.logSession}
        left={<Button kind="ghost" icon={X} accessibilityLabel={t.common.cancel} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={<Button kind="primary" size="sm" title={t.common.save} loading={saving} onPress={save} />}
      />
      <Screen>
        {params.source !== "timer" && !existing ? (
          <Pressable onPress={() => router.push("/timer")}>
            <Card>
              <Row gap={12}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
                  <Timer size={18} color={c.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt bold>{t.log.useTimer}</Txt>
                  <Txt v="small" muted>{t.log.useTimerHint}</Txt>
                </View>
                <ChevronRight size={18} color={c.mutedFg} />
              </Row>
            </Card>
          </Pressable>
        ) : null}

        <Segmented label={t.session.kind} value={kind} onChange={setKind} options={SESSION_KINDS.map((k) => ({ value: k, label: t.sessionKind[k] }))} />

        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <DateField label={t.log.date} value={date} onChange={setDate} placeholder={t.log.datePlaceholder} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label={t.log.start} value={time} onChangeText={setTime} placeholder="19:30" />
          </View>
        </Row>

        <Row gap={space.md}>
          <Stepper label={t.log.durationMin} value={durationMin} onChange={setDuration} step={15} min={15} max={600} />
          <Stepper label={t.session.rounds} value={rounds} onChange={setRounds} max={100} />
        </Row>

        <Col gap={8}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>{t.log.intensity}</Txt>
            <Txt bold>{rpe} · {t.log.rpe[rpe]}</Txt>
          </Row>
          <Row gap={4} accessibilityRole="adjustable" accessibilityLabel={t.log.intensityA11y}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                accessibilityLabel={`${n}`}
                onPress={() => setRpe(n)}
                style={{ flex: 1, height: 34, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: n <= rpe ? c.accent : c.muted, opacity: n <= rpe ? 0.35 + (n / 10) * 0.65 : 1 }}
              >
                <Txt v="small" bold color={n <= rpe ? "#fff" : c.mutedFg}>{n}</Txt>
              </Pressable>
            ))}
          </Row>
          <Txt v="small" muted>{t.log.intensityHint}</Txt>
        </Col>

        {activeAcademies.length ? (
          <Segmented
            label={t.nav.academy}
            value={academyId ?? ""}
            onChange={(v) => setAcademyId(v || null)}
            options={[...activeAcademies.map((m) => ({ value: m.academy.id, label: m.academy.name })), { value: "", label: t.log.elsewhere }]}
          />
        ) : null}

        <Input label={t.log.title} value={title} onChangeText={setTitle} placeholder={t.sessionTitle(t.sessionKind[kind])} maxLength={120} />

        <Col gap={8}>
          <Txt bold>{t.log.techniques}</Txt>
          <Row wrap gap={6}>
            {techniques.map((t) => (
              <Pressable key={t} onPress={() => setTechniques(techniques.filter((x) => x !== t))} style={{ backgroundColor: c.muted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", gap: 4, alignItems: "center" }}>
                <Txt v="small">{t}</Txt>
                <X size={12} color={c.mutedFg} />
              </Pressable>
            ))}
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Input value={technique} onChangeText={setTechnique} placeholder={t.log.techniquePlaceholder} onSubmitEditing={addTechnique} returnKeyType="done" />
            </View>
            <Button title={t.log.add} onPress={addTechnique} disabled={!technique.trim()} />
          </Row>
        </Col>

        <Input label={t.log.notes} value={notes} onChangeText={setNotes} placeholder={t.log.notesPlaceholder} multiline maxLength={5000} />

        <Segmented
          label={t.log.whoSees}
          value={visibility}
          onChange={setVisibility}
          options={(["public", "followers", "private"] as const).map((v) => ({ value: v, label: t.visibility[v], icon: VIS_ICON[v] }))}
        />

        <ErrorText error={error} />
        <Button kind="primary" size="lg" title={t.log.save} loading={saving} onPress={save} />
      </Screen>
    </>
  );
}
