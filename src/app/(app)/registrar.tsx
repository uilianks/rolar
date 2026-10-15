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
import { useCreateSession, useMe } from "@/lib/queries";
import type { ClassWithOccurrence } from "@/lib/types";
import { KIND_LABEL, SESSION_KINDS, sessionInput, VISIBILITY_LABEL, type SessionKind, type Visibility } from "@/shared/domain";
import { Button, Card, Col, ErrorText, Input, Loading, Row, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const RPE_LABEL = ["", "Muito leve", "Leve", "Leve", "Moderado", "Moderado", "Puxado", "Puxado", "Muito puxado", "Máximo", "Máximo"];
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
  const [notes, setNotes] = useState(fromClass?.topic ? `Tema da aula: ${fromClass.topic}` : "");
  const [techniques, setTechniques] = useState<string[]>([]);
  const [technique, setTechnique] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(me?.profile?.defaultVisibility ?? "followers");
  const [error, setError] = useState<string | null>(null);

  function addTechnique() {
    const t = technique.trim();
    if (t && !techniques.includes(t)) setTechniques([...techniques, t]);
    setTechnique("");
  }

  async function save() {
    setError(null);
    const startedAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startedAt.getTime())) return setError("Data ou hora inválida");
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
    if (!input.success) return setError(input.error.issues[0].message);
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
        title="Registrar treino"
        left={<Button kind="ghost" icon={X} accessibilityLabel="Cancelar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={<Button kind="primary" size="sm" title="Salvar" loading={create.isPending} onPress={save} />}
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
                  <Txt bold>Usar o timer de rounds</Txt>
                  <Txt v="small" muted>O treino é preenchido sozinho ao terminar</Txt>
                </View>
                <ChevronRight size={18} color={c.mutedFg} />
              </Row>
            </Card>
          </Pressable>
        ) : null}

        <Segmented label="Modalidade" value={kind} onChange={setKind} options={SESSION_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />

        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <Input label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Início" value={time} onChangeText={setTime} placeholder="19:30" />
          </View>
        </Row>

        <Row gap={space.md}>
          <Stepper label="Duração (min)" value={durationMin} onChange={setDuration} step={15} min={15} max={600} />
          <Stepper label="Rolas" value={rounds} onChange={setRounds} max={100} />
        </Row>

        <Col gap={8}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>Intensidade (esforço percebido)</Txt>
            <Txt bold>{rpe} · {RPE_LABEL[rpe]}</Txt>
          </Row>
          <Row gap={4} accessibilityRole="adjustable" accessibilityLabel="Intensidade de 1 a 10">
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
          <Txt v="small" muted>Usado para calcular a sua carga semanal. Não precisa de relógio nem de cinta cardíaca.</Txt>
        </Col>

        {activeAcademies.length ? (
          <Segmented
            label="Academia"
            value={academyId ?? ""}
            onChange={(v) => setAcademyId(v || null)}
            options={[...activeAcademies.map((m) => ({ value: m.academy.id, label: m.academy.name })), { value: "", label: "Outro lugar" }]}
          />
        ) : null}

        <Input label="Título" value={title} onChangeText={setTitle} placeholder={`Treino de ${KIND_LABEL[kind].toLowerCase()}`} maxLength={120} />

        <Col gap={8}>
          <Txt bold>Técnicas da aula</Txt>
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
              <Input value={technique} onChangeText={setTechnique} placeholder="Ex.: armlock da guarda" onSubmitEditing={addTechnique} returnKeyType="done" />
            </View>
            <Button title="Adicionar" onPress={addTechnique} disabled={!technique.trim()} />
          </Row>
        </Col>

        <Input label="Notas" value={notes} onChangeText={setNotes} placeholder="O que funcionou, o que travou, o que estudar…" multiline maxLength={5000} />

        <Segmented
          label="Quem pode ver"
          value={visibility}
          onChange={setVisibility}
          options={(["public", "followers", "private"] as const).map((v) => ({ value: v, label: VISIBILITY_LABEL[v], icon: VIS_ICON[v] }))}
        />

        <ErrorText error={error} />
        <Button kind="primary" size="lg" title="Salvar treino" loading={create.isPending} onPress={save} />
      </Screen>
    </>
  );
}
