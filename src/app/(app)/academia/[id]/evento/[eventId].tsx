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
import { dateFmt, whenLong } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAcademy, useMe } from "@/lib/queries";
import type { EventDetail } from "@/lib/types";
import { RESULTS, type Result } from "@/shared/domain";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const MEDAL: Record<Result, string> = { gold: "🥇", silver: "🥈", bronze: "🥉", participated: "🎽" };

/** An event: details, "I'm going" (with division for competitions), who goes, and results afterwards. */
export default function EventScreen() {
  const t = useT();
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
    if (!e || !(await confirm(t.event.deleteTitle(e.title), t.event.deleteText, t.academyCards.deleteAction))) return;
    await run(`/academies/${id}/events/${e.id}`, "DELETE");
    router.replace(`/academia/${id}`);
  }

  if (q.isPending) return <Loading />;
  if (!e) return <ErrorText error={q.error} />;

  return (
    <>
      <Header
        title={t.eventKind[e.kind]}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${id}`))} />}
        right={
          staff ? (
            <Row gap={4}>
              <Button kind="ghost" icon={Pencil} accessibilityLabel={t.eventForm.editTitle} onPress={() => router.push(`/academia/${id}/evento/novo?eventId=${e.id}`)} />
              <Button kind="ghost" icon={Trash} accessibilityLabel={t.event.delete} onPress={remove} />
            </Row>
          ) : undefined
        }
      />
      <Screen>
        <Card style={{ gap: space.sm }}>
          <Badge tone={competition ? "accent" : "default"}>{t.eventKind[e.kind]}</Badge>
          <Txt v="h1">{e.title}</Txt>
          <Txt muted>
            {whenLong(e.startsAt)}
            {e.endsAt ? ` ${t.event.until(whenLong(e.endsAt))}` : ""}
          </Txt>
          {e.location ? <Txt>{e.location}</Txt> : null}
          {e.signupUntil ? <Txt v="small" muted>{t.event.signupUntil(dateFmt({ day: "numeric", month: "long" }).format(new Date(`${e.signupUntil}T12:00:00`)))}</Txt> : null}
          {e.description ? <Txt style={{ marginTop: space.sm }}>{e.description}</Txt> : null}
          {e.url ? (
            <Button size="sm" icon={ExternalLink} title={competition ? t.event.competitionPage : t.event.openLink} onPress={() => Linking.openURL(e.url!)} style={{ alignSelf: "flex-start" }} />
          ) : null}
        </Card>

        {member && (signupOpen || mine) && !started ? (
          <Card style={{ gap: space.md }}>
            <Txt v="h3">{mine ? t.event.youGo : competition ? t.event.competeQ : t.event.joinQ}</Txt>
            {competition ? (
              <Input
                label={t.event.category}
                value={category ?? mine?.category ?? ""}
                onChangeText={setCategory}
                placeholder={t.event.categoryPlaceholder}
                hint={t.event.categoryHint}
              />
            ) : null}
            <Row gap={space.sm} wrap>
              {signupOpen ? (
                <Button
                  kind="primary"
                  title={mine ? t.event.update : competition ? t.event.willCompete : t.academyCards.imGoing}
                  onPress={() => run(`/academies/${id}/events/${e.id}/rsvp`, "PUT", { category: (category ?? mine?.category ?? "") || undefined })}
                />
              ) : null}
              {mine ? <Button kind="danger" title={t.event.notGoing} onPress={() => run(`/academies/${id}/events/${e.id}/rsvp`, "DELETE")} /> : null}
            </Row>
          </Card>
        ) : null}
        <ErrorText error={error} />

        {member ? (
          <Card pad={false}>
            <CardHead title={competition ? t.event.athletes(e.attendees.length) : t.event.goingList(e.attendees.length)} />
            {e.attendees.map((x) => {
              const canResult = competition && started && (x.id === me?.user.id || staff);
              return (
                <ListRow key={x.id} onPress={() => router.push(`/u/${x.username}`)}>
                  <Avatar uri={x.avatarUrl} name={x.name} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt bold>
                      {x.name} {x.result ? MEDAL[x.result] : ""}
                    </Txt>
                    <Txt v="tiny" muted>{[x.category, x.result ? t.result[x.result] : null].filter(Boolean).join(" · ") || " "}</Txt>
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
                            accessibilityLabel={t.event.resultFor(t.result[r], x.name)}
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
                <Txt v="small" color={c.mutedFg}>{t.event.nobodyYet}</Txt>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Txt muted>{t.event.membersOnly(e.going)}</Txt>
          </Card>
        )}
      </Screen>
    </>
  );
}
