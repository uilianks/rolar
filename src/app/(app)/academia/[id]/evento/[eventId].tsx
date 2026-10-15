import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ExternalLink from "lucide-react-native/icons/external-link";
import Pencil from "lucide-react-native/icons/pencil";
import Trash from "lucide-react-native/icons/trash";
import { useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { whenLong } from "@/lib/format";
import { useAcademy, useMe } from "@/lib/queries";
import type { EventDetail } from "@/lib/types";
import { EVENT_KIND_LABEL, RESULT_LABEL, RESULTS, type Result } from "@/shared/domain";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const MEDAL: Record<Result, string> = { gold: "🥇", silver: "🥈", bronze: "🥉", participated: "🎽" };

/** An event: details, "I'm going" (with division for competitions), who goes, and results afterwards. */
export default function EventScreen() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const me = useMe().data;
  const academy = useAcademy(id);
  const q = useQuery({ queryKey: ["event", eventId], queryFn: () => api<EventDetail>(`/academies/${id}/events/${eventId}`) });
  const e = q.data;
  const a = academy.data;
  const member = a?.membership?.status === "active";
  const staff = member && a?.membership?.role !== "student";
  const mine = e?.attendees.find((x) => x.id === me?.user.id);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const competition = e?.kind === "competition";
  // Read once per mount: whether the event started only changes on a refresh anyway.
  const [now] = useState(() => new Date());
  const started = e ? new Date(e.startsAt) <= now : false;
  const today = now.toISOString().slice(0, 10);
  const signupOpen = e ? !started && (!e.signupUntil || today <= e.signupUntil) : false;

  async function run(path: string, method: "PUT" | "DELETE", json?: unknown) {
    setError(null);
    try {
      await api(path, { method, json });
      await Promise.all([qc.invalidateQueries({ queryKey: ["event", eventId] }), qc.invalidateQueries({ queryKey: ["academy", a?.id] })]);
    } catch (err) {
      setError(err);
    }
  }

  async function remove() {
    if (!e || !(await confirm(`Apagar "${e.title}"?`, "Some do calendário, com as inscrições e os resultados.", "Apagar"))) return;
    await run(`/academies/${id}/events/${e.id}`, "DELETE");
    router.replace(`/academia/${id}`);
  }

  if (q.isPending) return <Loading />;
  if (!e) return <ErrorText error={q.error} />;

  return (
    <>
      <Header
        title={EVENT_KIND_LABEL[e.kind]}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
        right={
          staff ? (
            <Row gap={4}>
              <Button kind="ghost" icon={Pencil} accessibilityLabel="Editar evento" onPress={() => router.push(`/academia/${id}/evento/novo?eventId=${e.id}`)} />
              <Button kind="ghost" icon={Trash} accessibilityLabel="Apagar evento" onPress={remove} />
            </Row>
          ) : undefined
        }
      />
      <Screen>
        <Card style={{ gap: space.sm }}>
          <Badge tone={competition ? "accent" : "default"}>{EVENT_KIND_LABEL[e.kind]}</Badge>
          <Txt v="h1">{e.title}</Txt>
          <Txt muted>
            {whenLong(e.startsAt)}
            {e.endsAt ? ` até ${whenLong(e.endsAt)}` : ""}
          </Txt>
          {e.location ? <Txt>{e.location}</Txt> : null}
          {e.signupUntil ? <Txt v="small" muted>Inscrições até {new Date(`${e.signupUntil}T12:00:00`).toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}</Txt> : null}
          {e.description ? <Txt style={{ marginTop: space.sm }}>{e.description}</Txt> : null}
          {e.url ? (
            <Button size="sm" icon={ExternalLink} title={competition ? "Página da prova / inscrição" : "Abrir link"} onPress={() => Linking.openURL(e.url!)} style={{ alignSelf: "flex-start" }} />
          ) : null}
        </Card>

        {member && (signupOpen || mine) && !started ? (
          <Card style={{ gap: space.md }}>
            <Txt v="h3">{mine ? "Você vai ✔" : competition ? "Vai competir?" : "Vai participar?"}</Txt>
            {competition ? (
              <Input
                label="Categoria"
                value={category ?? mine?.category ?? ""}
                onChangeText={setCategory}
                placeholder="Adulto · Azul · Médio (-82,3 kg)"
                hint="Como se inscreveu na prova; ajuda o professor a preparar o treino."
              />
            ) : null}
            <Row gap={space.sm} wrap>
              {signupOpen ? (
                <Button
                  kind="primary"
                  title={mine ? "Atualizar" : competition ? "Vou competir" : "Vou"}
                  onPress={() => run(`/academies/${id}/events/${e.id}/rsvp`, "PUT", { category: (category ?? mine?.category ?? "") || undefined })}
                />
              ) : null}
              {mine ? <Button kind="danger" title="Não vou mais" onPress={() => run(`/academies/${id}/events/${e.id}/rsvp`, "DELETE")} /> : null}
            </Row>
          </Card>
        ) : null}
        <ErrorText error={error} />

        {member ? (
          <Card pad={false}>
            <CardHead title={competition ? `Atletas (${e.attendees.length})` : `Vão (${e.attendees.length})`} />
            {e.attendees.map((x) => {
              const canResult = competition && started && (x.id === me?.user.id || staff);
              return (
                <ListRow key={x.id} onPress={() => router.push(`/u/${x.username}`)}>
                  <Avatar uri={x.avatarUrl} name={x.name} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt bold>
                      {x.name} {x.result ? MEDAL[x.result] : ""}
                    </Txt>
                    <Txt v="tiny" muted>{[x.category, x.result ? RESULT_LABEL[x.result] : null].filter(Boolean).join(" · ") || " "}</Txt>
                  </View>
                  <Belt belt={x.belt} stripes={x.stripes} />
                  {canResult ? (
                    <Col gap={4}>
                      <Row gap={4} wrap>
                        {RESULTS.map((r) => (
                          <Button
                            key={r}
                            size="sm"
                            kind={x.result === r ? "primary" : "default"}
                            title={MEDAL[r]}
                            accessibilityLabel={`${RESULT_LABEL[r]} para ${x.name}`}
                            onPress={() => run(`/academies/${id}/events/${e.id}/results/${x.id}`, "PUT", { result: x.result === r ? null : r })}
                          />
                        ))}
                      </Row>
                    </Col>
                  ) : null}
                </ListRow>
              );
            })}
            {!e.attendees.length ? (
              <View style={{ padding: space.lg }}>
                <Txt v="small" color={c.mutedFg}>Ninguém confirmou ainda.</Txt>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Txt muted>{e.going} pessoa(s) da academia vão. A lista é só para membros.</Txt>
          </Card>
        )}
      </Screen>
    </>
  );
}
