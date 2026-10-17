import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Flag from "lucide-react-native/icons/flag";
import Pencil from "lucide-react-native/icons/pencil";
import Send from "lucide-react-native/icons/send";
import ImageIcon from "lucide-react-native/icons/image";
import Share2 from "lucide-react-native/icons/share-2";
import Trash2 from "lucide-react-native/icons/trash";
import { useState } from "react";
import { Platform, Pressable, Share, View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { ago, duration, whenLong } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { storySupported } from "@/lib/story-image";
import { useDeleteSession, useMe, useSession } from "@/lib/queries";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, Kpi, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Chips, OssButton } from "@/ui/session-card";
import { FinishChips } from "@/ui/finish-list";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

export default function SessionScreen() {
  const t = useT();
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const me = useMe().data;
  const session = useSession(id);
  const remove = useDeleteSession();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const s = session.data;
  const mine = s?.author.id === me?.user.id;

  async function send() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/sessions/${id}/comments`, { method: "POST", json: { body: comment.trim() } });
      setComment("");
      await qc.invalidateQueries({ queryKey: ["session", id] });
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  async function deleteComment(commentId: string) {
    if (!(await confirm(t.sessionDetail.deleteCommentTitle, t.sessionDetail.cannotUndo, t.academyCards.deleteAction))) return;
    await api(`/comments/${commentId}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["session", id] });
  }

  async function deleteSession() {
    if (!(await confirm(t.sessionDetail.deleteTitle, t.sessionDetail.deleteText, t.academyCards.deleteAction))) return;
    await remove.mutateAsync(id);
    router.replace("/");
  }

  async function report() {
    if (!(await confirm(t.sessionDetail.reportTitle, t.sessionDetail.reportText, t.profile.report))) return;
    await api("/reports", { method: "POST", json: { targetType: "session", targetId: id, reason: t.profile.reportReason } });
  }

  function share() {
    const text = t.sessionDetail.shareText(s?.title || t.reportTarget.session);
    if (Platform.OS === "web") void navigator.clipboard?.writeText(window.location.href);
    else void Share.share({ message: text });
  }

  return (
    <>
      <Header
        title={t.reportTarget.session}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={
          s ? (
            <Row gap={4}>
              <Button kind="ghost" icon={Share2} accessibilityLabel={t.sessionDetail.share} onPress={share} />
              {mine ? (
                <Button kind="ghost" icon={Pencil} accessibilityLabel={t.sessionDetail.edit} onPress={() => router.push({ pathname: "/registrar", params: { sessionId: s.id } })} />
              ) : null}
              {mine ? (
                <Button kind="ghost" icon={Trash2} accessibilityLabel={t.sessionDetail.delete} onPress={deleteSession} />
              ) : (
                <Button kind="ghost" icon={Flag} accessibilityLabel={t.profile.report} onPress={report} />
              )}
            </Row>
          ) : null
        }
      />
      <Screen onRefresh={() => session.refetch()} refreshing={session.isRefetching}>
        {session.isPending ? <Loading /> : null}
        <ErrorText error={session.error} />
        {s ? (
          <>
            <Col>
              <Row>
                <Pressable onPress={() => router.push(`/u/${s.author.username}`)}>
                  <Avatar uri={s.author.avatarUrl} name={s.author.name} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Row>
                    <Txt bold>{s.author.name}</Txt>
                    <Belt belt={s.author.belt} stripes={s.author.stripes} />
                  </Row>
                  <Txt v="small" muted>
                    {whenLong(s.startedAt)}
                    {s.academy ? ` · ${s.academy.name}` : ""}
                  </Txt>
                </View>
                <Badge>{t.visibility[s.visibility]}</Badge>
              </Row>
              <Txt v="h1">{s.title || t.sessionTitle(t.sessionKind[s.kind])}</Txt>
              {s.notes ? <Txt>{s.notes}</Txt> : null}
            </Col>

            <Row wrap gap={space.md}>
              <Kpi label={t.session.kind} value={t.sessionKind[s.kind]} />
              <Kpi label={t.session.duration} value={duration(s.durationMin)} />
              <Kpi label={t.session.rounds} value={String(s.rounds)} />
              <Kpi
                label={t.session.intensity}
                value={s.rpe ? `${s.rpe}/10` : t.session.noIntensity}
                sub={s.rpe ? t.sessionDetail.load(s.durationMin * s.rpe) : undefined}
              />
            </Row>

            {mine && storySupported ? (
              <Button icon={ImageIcon} title={t.story.create} onPress={() => router.push({ pathname: "/imagem", params: { treino: s.id } })} />
            ) : null}

            {s.techniques.length ? (
              <Card pad={false}>
                <CardHead title={t.log.techniques} />
                <View style={{ padding: space.lg }}>
                  <Chips items={s.techniques} />
                </View>
              </Card>
            ) : null}

            {s.submissions.length || s.taps.length ? (
              <Card pad={false}>
                <CardHead title={t.finishes.title} />
                <Col style={{ padding: space.lg }}>
                  {s.submissions.length ? (
                    <Col gap={6}>
                      <Txt v="small" muted>{t.finishes.submissions}</Txt>
                      <FinishChips items={s.submissions} tone="got" />
                    </Col>
                  ) : null}
                  {s.taps.length ? (
                    <Col gap={6}>
                      <Txt v="small" muted>{t.finishes.taps}</Txt>
                      <FinishChips items={s.taps} tone="tapped" />
                    </Col>
                  ) : null}
                </Col>
              </Card>
            ) : null}

            <Card pad={false}>
              <CardHead
                title={t.sessionDetail.counts(s.ossCount, s.commentCount)}
                right={<OssButton session={s} />}
              />
              {s.ossBy.length ? (
                <ListRow>
                  <Txt v="small" muted>{t.sessionDetail.ossBy(s.ossBy.map((o) => o.name).join(", "))}</Txt>
                </ListRow>
              ) : null}
              {s.comments.map((cm) => (
                <ListRow key={cm.id}>
                  <Avatar uri={cm.author.avatarUrl} name={cm.author.name} size={28} />
                  <View style={{ flex: 1 }}>
                    <Txt>
                      <Txt bold>{cm.author.name}</Txt> <Txt v="tiny" muted>{ago(cm.createdAt)}</Txt>
                    </Txt>
                    <Txt>{cm.body}</Txt>
                  </View>
                  {mine || cm.author.id === me?.user.id ? (
                    <Button kind="ghost" size="sm" icon={Trash2} accessibilityLabel={t.sessionDetail.deleteComment} onPress={() => deleteComment(cm.id)} />
                  ) : null}
                </ListRow>
              ))}
              <View style={{ padding: space.md, flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Input value={comment} onChangeText={setComment} placeholder={t.sessionDetail.commentPlaceholder} maxLength={2000} onSubmitEditing={send} />
                </View>
                <Button kind="primary" icon={Send} accessibilityLabel={t.sessionDetail.sendComment} loading={busy} onPress={send} disabled={!comment.trim()} />
              </View>
              <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
                <ErrorText error={error} />
              </View>
            </Card>
            {s.source === "timer" || s.source === "checkin" ? (
              <Txt v="tiny" muted style={{ color: c.mutedFg }}>{s.source === "timer" ? t.sessionDetail.fromTimer : t.sessionDetail.fromCheckin}</Txt>
            ) : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}
