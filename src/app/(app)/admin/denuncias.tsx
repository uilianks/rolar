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
import { useT } from "@/lib/i18n";
import type { AdminReportGroup } from "@/lib/types";
import { type ReportAction } from "@/shared/domain";
import { Avatar, Badge, Button, Card, Col, Empty, ErrorText, Input, ListRow, Loading, Row, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";


/** Distinct reasons with how many people gave each. */
function reasonCounts(reasons: string[]) {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts];
}

function ReportCase({ g }: { g: AdminReportGroup }) {
  const t = useT();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<ReportAction | null>(null);
  const owner = g.target?.owner ?? null;
  const open = !g.resolvedAt;

  async function resolve(action: ReportAction) {
    setError(null);
    const needsNote = action === "suspend" || (action === "remove" && g.targetType === "academy");
    if (needsNote && note.trim().length < 5) return setError(t.admin.writeReason);
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
          <Badge>{t.reportTarget[g.targetType]}</Badge>
          <Txt v="small" muted>
            {t.admin.reports(g.count)} · {t.admin.since(ago(g.firstAt))}
          </Txt>
        </Row>
        {g.resolvedAt && g.action ? <Badge tone={g.action === "dismiss" ? "default" : "success"}>{t.reportAction[g.action]}</Badge> : null}
      </Row>

      {g.target ? (
        <Col gap={4}>
          <Txt bold>{g.target.title}</Txt>
          {g.target.body ? <Txt v="small">{g.target.body}</Txt> : null}
        </Col>
      ) : (
        <Txt muted>{t.admin.contentGone}</Txt>
      )}

      {owner ? (
        <ListRow onPress={() => router.push(`/admin/usuario/${owner.id}`)}>
          <Avatar uri={owner.avatarUrl} name={owner.name} size={32} />
          <View style={{ flex: 1 }}>
            <Txt bold>{owner.name}</Txt>
            <Txt v="tiny" muted>@{owner.username}</Txt>
          </View>
          {owner.suspended ? <Badge tone="accent">{t.admin.suspended}</Badge> : null}
        </ListRow>
      ) : null}

      <Col gap={2}>
        <Txt v="tiny" muted>{t.admin.reasons}</Txt>
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
            label={t.admin.noteRequired}
            value={note}
            onChangeText={setNote}
            multiline
            placeholder={t.admin.notePlaceholder}
          />
          <ErrorText error={error} />
          <Row gap={space.sm} wrap>
            <Button icon={Check} title={t.reportAction.dismiss} loading={busy === "dismiss"} disabled={!!busy} onPress={() => resolve("dismiss")} />
            {g.target && g.targetType !== "user" ? (
              <Button
                kind="danger"
                icon={Trash}
                title={g.targetType === "academy" ? t.admin.rejectAcademy : t.admin.removeContent}
                loading={busy === "remove"}
                disabled={!!busy}
                onPress={() => resolve("remove")}
              />
            ) : null}
            {owner?.avatarUrl ? <Button kind="danger" icon={ImageOff} title={t.admin.removePhoto} loading={busy === "remove_avatar"} disabled={!!busy} onPress={() => resolve("remove_avatar")} /> : null}
            {owner && !owner.suspended ? <Button kind="danger" icon={Ban} title={t.admin.suspend} loading={busy === "suspend"} disabled={!!busy} onPress={() => resolve("suspend")} /> : null}
          </Row>
        </>
      ) : (
        <Txt v="small" muted>
          {t.admin.decided(ago(g.resolvedAt!))}
          {g.note ? ` · ${g.note}` : ""}
        </Txt>
      )}
    </Card>
  );
}

/** Moderation queue (DSA notice and action): every report on one target is decided at once. */
export default function AdminReports() {
  const t = useT();
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const list = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => api<AdminReportGroup[]>(`/admin/reports?status=${status}`) });

  return (
    <>
      <Header
        title={t.admin.reportsTitle}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
        right={<Button kind="ghost" size="sm" title={t.notifications.refresh} onPress={() => list.refetch()} />}
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Txt muted>{t.admin.reportsIntro}</Txt>
        <Tabs value={status} onChange={setStatus} options={[{ value: "open", label: t.admin.openTab }, { value: "resolved", label: t.admin.resolvedTab }]} />
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.map((g) => <ReportCase key={`${g.targetType}/${g.targetId}/${g.resolvedAt ?? ""}`} g={g} />)}
        {list.data && !list.data.length ? (
          <Card>
            <Empty icon={Inbox} title={status === "open" ? t.admin.noOpenReports : t.admin.noDecisions} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
