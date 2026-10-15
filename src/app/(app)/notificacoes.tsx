import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import BellOff from "lucide-react-native/icons/bell-off";
import { useEffect } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useNotifications } from "@/lib/queries";
import type { Notification } from "@/lib/types";
import { Avatar, Button, Card, Empty, ErrorText, ListRow, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

const TEXT: Record<string, string> = {
  oss: "deu Oss no seu treino",
  comment: "comentou no seu treino",
  follow: "começou a te seguir",
  membership_request: "pediu para entrar na academia",
  membership_approved: "aprovou a sua entrada na academia",
  promotion_request: "pediu confirmação de graduação",
  promotion_confirmed: "confirmou a sua graduação",
  academy_submitted: "enviou uma academia para verificação",
  academy_approved: "aprovou o cadastro da sua academia",
  academy_rejected: "recusou o cadastro da sua academia",
  attendance_confirmed: "confirmou a sua presença na aula. Toque para registrar o treino",
  class_cancelled: "cancelou uma aula. Toque para ver o calendário",
  event_published: "publicou um evento na academia",
  announcement: "publicou um aviso na academia",
  payment_reminder: "lembrou que a sua mensalidade está em aberto",
};

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
}

export default function Notifications() {
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
      <Header title="Notificações" right={<Button kind="ghost" size="sm" title="Atualizar" onPress={() => list.refetch()} />} />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.length ? (
          <Card pad={false}>
            {list.data.map((n) => (
              <ListRow key={n.id} onPress={() => open(n)} highlight={!n.readAt}>
                <Avatar name={n.actor?.name ?? "?"} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt>
                    <Txt bold>{n.actor?.name ?? "Alguém"}</Txt> {TEXT[n.type] ?? n.type}
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
              title="Nada por aqui ainda"
              text="Quando alguém der Oss, comentar ou a sua academia aprovar a sua entrada, aparece aqui."
              action={<Button size="sm" title="Encontrar minha academia" onPress={() => router.navigate("/academia")} />}
            />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
