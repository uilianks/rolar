import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Flag from "lucide-react-native/icons/flag";
import Send from "lucide-react-native/icons/send";
import Share2 from "lucide-react-native/icons/share-2";
import Trash2 from "lucide-react-native/icons/trash";
import { useState } from "react";
import { Platform, Pressable, Share, View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { ago, duration, whenLong } from "@/lib/format";
import { useDeleteSession, useMe, useSession } from "@/lib/queries";
import { KIND_LABEL, VISIBILITY_LABEL } from "@/shared/domain";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, Input, Kpi, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Chips, OssButton } from "@/ui/session-card";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

export default function SessionScreen() {
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
    if (!(await confirm("Apagar comentário?", "Essa ação não pode ser desfeita.", "Apagar"))) return;
    await api(`/comments/${commentId}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["session", id] });
  }

  async function deleteSession() {
    if (!(await confirm("Apagar treino?", "O treino, os Oss e os comentários serão apagados.", "Apagar"))) return;
    await remove.mutateAsync(id);
    router.replace("/");
  }

  async function report() {
    if (!(await confirm("Denunciar treino?", "A equipe do projeto vai analisar o conteúdo.", "Denunciar"))) return;
    await api("/reports", { method: "POST", json: { targetType: "session", targetId: id, reason: "Denúncia pelo app" } });
  }

  function share() {
    const text = `${s?.title || "Treino"} no tatame`;
    if (Platform.OS === "web") void navigator.clipboard?.writeText(window.location.href);
    else void Share.share({ message: text });
  }

  return (
    <>
      <Header
        title="Treino"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={
          s ? (
            <Row gap={4}>
              <Button kind="ghost" icon={Share2} accessibilityLabel="Compartilhar" onPress={share} />
              {mine ? (
                <Button kind="ghost" icon={Trash2} accessibilityLabel="Apagar treino" onPress={deleteSession} />
              ) : (
                <Button kind="ghost" icon={Flag} accessibilityLabel="Denunciar" onPress={report} />
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
                  <Avatar name={s.author.name} />
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
                <Badge>{VISIBILITY_LABEL[s.visibility]}</Badge>
              </Row>
              <Txt v="h1">{s.title || `Treino de ${KIND_LABEL[s.kind].toLowerCase()}`}</Txt>
              {s.notes ? <Txt>{s.notes}</Txt> : null}
            </Col>

            <Row wrap gap={space.md}>
              <Kpi label="Modalidade" value={KIND_LABEL[s.kind]} />
              <Kpi label="Duração" value={duration(s.durationMin)} />
              <Kpi label="Rolas" value={String(s.rounds)} />
              <Kpi label="Intensidade" value={`${s.rpe}/10`} sub={`Carga ${s.durationMin * s.rpe}`} />
            </Row>

            {s.techniques.length ? (
              <Card pad={false}>
                <CardHead title="Técnicas da aula" />
                <View style={{ padding: space.lg }}>
                  <Chips items={s.techniques} />
                </View>
              </Card>
            ) : null}

            <Card pad={false}>
              <CardHead
                title={`${s.ossCount} Oss · ${s.commentCount} comentários`}
                right={<OssButton session={s} />}
              />
              {s.ossBy.length ? (
                <ListRow>
                  <Txt v="small" muted>Oss de {s.ossBy.map((o) => o.name).join(", ")}</Txt>
                </ListRow>
              ) : null}
              {s.comments.map((cm) => (
                <ListRow key={cm.id}>
                  <Avatar name={cm.author.name} size={28} />
                  <View style={{ flex: 1 }}>
                    <Txt>
                      <Txt bold>{cm.author.name}</Txt> <Txt v="tiny" muted>{ago(cm.createdAt)}</Txt>
                    </Txt>
                    <Txt>{cm.body}</Txt>
                  </View>
                  {mine || cm.author.id === me?.user.id ? (
                    <Button kind="ghost" size="sm" icon={Trash2} accessibilityLabel="Apagar comentário" onPress={() => deleteComment(cm.id)} />
                  ) : null}
                </ListRow>
              ))}
              <View style={{ padding: space.md, flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Input value={comment} onChangeText={setComment} placeholder="Escreva um comentário…" maxLength={2000} onSubmitEditing={send} />
                </View>
                <Button kind="primary" icon={Send} accessibilityLabel="Enviar comentário" loading={busy} onPress={send} disabled={!comment.trim()} />
              </View>
              <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
                <ErrorText error={error} />
              </View>
            </Card>
            {s.source === "timer" ? <Txt v="tiny" muted style={{ color: c.mutedFg }}>Registrado pelo timer de rounds.</Txt> : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}
