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
import { useCreateSession, useMe } from "@/lib/queries";
import type { ClassWithOccurrence } from "@/lib/types";
import { SESSION_KINDS, sessionInput, type SessionKind, type Visibility } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Button, Card, Col, ErrorText, Input, Loading, Row, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const VIS_ICON = { public: Globe, followers: Users, private: Lock };

type Params = { durationMin?: string; rounds?: string; kind?: string; source?: string; classId?: string; date?: string };

/** Log a session; prefilled by the timer (duration, rounds) or by a roll call (class and date). */
export default function Register() {
  const params = useLocalSearchParams<Params>();
  const fromClass = useQuery({
    queryKey: ["class", params.classId, params.date],
    queryFn: () => api<ClassWithOccurrence>(`/classes/${params.classId}${params.date ? `?date=${params.date}` : ""}`),
    enabled: !!params.classId,
  });
  if (params.classId && fromClass.isPending) return <Loading />;
  return <RegisterForm params={params} fromClass={fromClass.data} />;
}

function RegisterForm({ params, fromClass }: { params: Params; fromClass?: ClassWithOccurrence }) {
  const t = useT();
  const { c } = useTheme();
  const me = useMe().data;
  const create = useCreateSession();
  const now = new Date();
  const activeAcademies = (me?.memberships ?? []).filter((m) => m.status === "active");
  const presetKind = fromClass?.kind ?? params.kind;

  const [kind, setKind] = useState<SessionKind>((SESSION_KINDS as readonly string[]).includes(presetKind ?? "") ? (presetKind as SessionKind) : "gi");
  const [date, setDate] = useState(fromClass && params.date ? params.date : ymd(now));
  const [time, setTime] = useState(fromClass?.startTime ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const [durationMin, setDuration] = useState(fromClass?.durationMin ?? (Number(params.durationMin) || 90));
  const [rounds, setRounds] = useState(Number(params.rounds) || 0);
  const [rpe, setRpe] = useState(7);
  const [academyId, setAcademyId] = useState<string | null>(fromClass?.academyId ?? me?.profile?.homeAcademyId ?? null);
  const [title, setTitle] = useState(fromClass?.title ?? "");
  const [notes, setNotes] = useState(fromClass?.topic ? t.log.topicNote(fromClass.topic) : "");
  const [techniques, setTechniques] = useState<string[]>([]);
  const [technique, setTechnique] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(me?.profile?.defaultVisibility ?? "followers");
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
      const s = await create.mutateAsync(input.data);
      router.replace(`/treino/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Header
        title={t.nav.logSession}
        left={<Button kind="ghost" icon={X} accessibilityLabel={t.common.cancel} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={<Button kind="primary" size="sm" title={t.common.save} loading={create.isPending} onPress={save} />}
      />
      <Screen>
        {params.source !== "timer" ? (
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
            <Input label={t.log.date} value={date} onChangeText={setDate} placeholder={t.log.datePlaceholder} />
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
        <Button kind="primary" size="lg" title={t.log.save} loading={create.isPending} onPress={save} />
      </Screen>
    </>
  );
}
