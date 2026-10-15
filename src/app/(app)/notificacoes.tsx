import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import BellOff from "lucide-react-native/icons/bell-off";
import { useEffect } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useNotifications } from "@/lib/queries";
import type { Notification } from "@/lib/types";
import { Avatar, Button, Card, Empty, ErrorText, ListRow, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

function open(n: Notification) {
  if (n.type === "oss" || n.type === "comment") return router.push(`/treino/${n.targetId}`);
  if (n.type === "follow" && n.actor) return router.push(`/u/${n.actor.username}`);
  if (n.type.startsWith("membership")) return router.push(`/academia/${n.targetId}`);
  if (n.type === "attendance_confirmed" && n.targetId) {
    const [classId, date] = n.targetId.split("/");
    return router.push({ pathname: "/registrar", params: { classId, date } });
  }
  if (n.type === "class_cancelled" && n.targetId) {
    const [academyId, date] = n.targetId.split("/");
    return router.push({ pathname: "/academia/[id]/calendario", params: { id: academyId, date } });
  }
  if (n.type === "event_published" && n.targetId) {
    const [academyId, eventId] = n.targetId.split("/");
    return router.push(`/academia/${academyId}/evento/${eventId}`);
  }
  if ((n.type === "announcement" || n.type === "payment_reminder") && n.targetId) return router.push(`/academia/${n.targetId}`);
  if (n.type === "academy_submitted") return router.push(`/admin/${n.targetId}`);
  if (n.type.startsWith("academy_")) return router.push(`/academia/${n.targetId}`);
  if (n.type === "promotion_request") return router.push("/academia");
  if (n.type === "promotion_confirmed") return router.push("/perfil");
  if (n.type === "content_removed") return router.push("/termos");
}

export default function Notifications() {
  const t = useT();
  const { c } = useTheme();
  const qc = useQueryClient();
  const list = useNotifications();
  const unread = (list.data ?? []).some((n) => !n.readAt);

  // Opening the screen marks everything as read (the list keeps the highlight until the next refresh).
  useEffect(() => {
    if (!unread) return;
    void api("/me/notifications/read", { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["me"] }));
  }, [unread, qc]);

  return (
    <>
      <Header title={t.nav.notifications} right={<Button kind="ghost" size="sm" title={t.notifications.refresh} onPress={() => list.refetch()} />} />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.length ? (
          <Card pad={false}>
            {list.data.map((n) => (
              <ListRow key={n.id} onPress={() => open(n)} highlight={!n.readAt}>
                <Avatar uri={n.actor?.avatarUrl} name={n.actor?.name ?? "?"} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt>
                    <Txt bold>{n.actor?.name ?? t.notifications.someone}</Txt> {(t.notifications.types as Record<string, string>)[n.type] ?? n.type}
                  </Txt>
                  <Txt v="tiny" muted>{ago(n.createdAt)}</Txt>
                </View>
                {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
              </ListRow>
            ))}
          </Card>
        ) : list.data ? (
          <Card>
            <Empty
              icon={BellOff}
              title={t.notifications.empty}
              text={t.notifications.emptyText}
              action={<Button size="sm" title={t.notifications.findAcademy} onPress={() => router.navigate("/academia")} />}
            />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
