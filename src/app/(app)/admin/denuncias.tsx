import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Ban from "lucide-react-native/icons/ban";
import Check from "lucide-react-native/icons/check";
import ImageOff from "lucide-react-native/icons/image-off";
import Inbox from "lucide-react-native/icons/inbox";
import Trash from "lucide-react-native/icons/trash";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import type { AdminReportGroup } from "@/lib/types";
import { REPORT_ACTION_LABEL, type ReportAction, type ReportTarget } from "@/shared/domain";
import { Avatar, Badge, Button, Card, Col, Empty, ErrorText, Input, ListRow, Loading, Row, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

const TARGET_LABEL: Record<ReportTarget, string> = { user: "Perfil", session: "Treino", comment: "Comentário", academy: "Academia" };

/** Distinct reasons with how many people gave each. */
function reasonCounts(reasons: string[]) {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts];
}

function ReportCase({ g }: { g: AdminReportGroup }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<ReportAction | null>(null);
  const owner = g.target?.owner ?? null;
  const open = !g.resolvedAt;

  async function resolve(action: ReportAction) {
    setError(null);
    const needsNote = action === "suspend" || (action === "remove" && g.targetType === "academy");
    if (needsNote && note.trim().length < 5) return setError("Escreva o motivo; a pessoa vai ler.");
    setBusy(action);
    try {
      await api("/admin/reports/resolve", { method: "POST", json: { targetType: g.targetType, targetId: g.targetId, action, note: note.trim() || undefined } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <Row wrap style={{ justifyContent: "space-between" }}>
        <Row gap={6}>
          <Badge>{TARGET_LABEL[g.targetType]}</Badge>
          <Txt v="small" muted>
            {g.count === 1 ? "1 denúncia" : `${g.count} denúncias`} · desde {ago(g.firstAt)}
          </Txt>
        </Row>
        {g.resolvedAt && g.action ? <Badge tone={g.action === "dismiss" ? "default" : "success"}>{REPORT_ACTION_LABEL[g.action]}</Badge> : null}
      </Row>

      {g.target ? (
        <Col gap={4}>
          <Txt bold>{g.target.title}</Txt>
          {g.target.body ? <Txt v="small">{g.target.body}</Txt> : null}
        </Col>
      ) : (
        <Txt muted>O conteúdo já foi apagado.</Txt>
      )}

      {owner ? (
        <ListRow onPress={() => router.push(`/admin/usuario/${owner.id}`)}>
          <Avatar uri={owner.avatarUrl} name={owner.name} size={32} />
          <View style={{ flex: 1 }}>
            <Txt bold>{owner.name}</Txt>
            <Txt v="tiny" muted>@{owner.username}</Txt>
          </View>
          {owner.suspended ? <Badge tone="accent">Suspensa</Badge> : null}
        </ListRow>
      ) : null}

      <Col gap={2}>
        <Txt v="tiny" muted>Motivos</Txt>
        {reasonCounts(g.reasons).map(([reason, n]) => (
          <Txt key={reason} v="small">
            {n > 1 ? `${n}× ` : ""}
            {reason}
          </Txt>
        ))}
      </Col>

      {open ? (
        <>
          <Input
            label="Nota (obrigatória para suspender ou recusar academia)"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Ex.: Mensagens de assédio a outros alunos, contra as regras de conduta."
          />
          <ErrorText error={error} />
          <Row gap={space.sm} wrap>
            <Button icon={Check} title="Sem violação" loading={busy === "dismiss"} disabled={!!busy} onPress={() => resolve("dismiss")} />
            {g.target && g.targetType !== "user" ? (
              <Button
                kind="danger"
                icon={Trash}
                title={g.targetType === "academy" ? "Recusar academia" : "Remover conteúdo"}
                loading={busy === "remove"}
                disabled={!!busy}
                onPress={() => resolve("remove")}
              />
            ) : null}
            {owner?.avatarUrl ? <Button kind="danger" icon={ImageOff} title="Remover foto" loading={busy === "remove_avatar"} disabled={!!busy} onPress={() => resolve("remove_avatar")} /> : null}
            {owner && !owner.suspended ? <Button kind="danger" icon={Ban} title="Suspender conta" loading={busy === "suspend"} disabled={!!busy} onPress={() => resolve("suspend")} /> : null}
          </Row>
        </>
      ) : (
        <Txt v="small" muted>
          Decidida {ago(g.resolvedAt!)}
          {g.note ? ` · ${g.note}` : ""}
        </Txt>
      )}
    </Card>
  );
}

/** Moderation queue (DSA notice and action): every report on one target is decided at once. */
export default function AdminReports() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const list = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => api<AdminReportGroup[]>(`/admin/reports?status=${status}`) });

  return (
    <>
      <Header
        title="Denúncias"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
        right={<Button kind="ghost" size="sm" title="Atualizar" onPress={() => list.refetch()} />}
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Txt muted>Quem denunciou é avisado da decisão. Quem teve conteúdo removido recebe uma notificação que aponta para os termos de uso.</Txt>
        <View style={{ maxWidth: 320 }}>
          <Tabs value={status} onChange={setStatus} options={[{ value: "open", label: "Em aberto" }, { value: "resolved", label: "Decididas" }]} />
        </View>
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.map((g) => <ReportCase key={`${g.targetType}/${g.targetId}/${g.resolvedAt ?? ""}`} g={g} />)}
        {list.data && !list.data.length ? (
          <Card>
            <Empty icon={Inbox} title={status === "open" ? "Nenhuma denúncia em aberto" : "Nenhuma decisão ainda"} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
