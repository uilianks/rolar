import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Inbox from "lucide-react-native/icons/inbox";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import type { AdminAcademyRow } from "@/lib/types";
import type { AcademyStatus } from "@/shared/domain";
import { Avatar, Button, Card, Col, Empty, ErrorText, ListRow, Loading, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";

/** Review queue for academy registrations. */
export default function AdminAcademies() {
  const [status, setStatus] = useState<AcademyStatus>("pending");
  const list = useQuery({ queryKey: ["admin", "academies", status], queryFn: () => api<AdminAcademyRow[]>(`/admin/academies?status=${status}`) });

  return (
    <>
      <Header
        title="Academias"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
        right={<Button kind="ghost" size="sm" title="Atualizar" onPress={() => list.refetch()} />}
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Col gap={4}>
          <Txt v="h1">Verificação de academias</Txt>
          <Txt muted>Confira os canais oficiais antes de aprovar. Academias pendentes não aparecem para ninguém.</Txt>
        </Col>
        <View style={{ maxWidth: 420 }}>
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: "Pendentes" },
              { value: "approved", label: "Aprovadas" },
              { value: "rejected", label: "Recusadas" },
            ]}
          />
        </View>
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.length ? (
          <Card pad={false}>
            {list.data.map((a) => (
              <ListRow key={a.id} onPress={() => router.push(`/admin/${a.id}`)}>
                <Avatar name={a.name} size={32} square />
                <View style={{ flex: 1 }}>
                  <Txt bold>{a.name}</Txt>
                  <Txt v="tiny" muted>
                    {[[a.city, a.country].filter(Boolean).join(", "), a.requester ? `por ${a.requester.name}` : null, status === "pending" ? `enviada ${ago(a.submittedAt)}` : a.reviewedAt ? `revista ${ago(a.reviewedAt)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                </View>
              </ListRow>
            ))}
          </Card>
        ) : list.data ? (
          <Card>
            <Empty icon={Inbox} title={status === "pending" ? "Nada para rever" : "Nenhuma academia aqui"} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
