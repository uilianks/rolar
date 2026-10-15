import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Inbox from "lucide-react-native/icons/inbox";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AdminAcademyRow } from "@/lib/types";
import type { AcademyStatus } from "@/shared/domain";
import { Avatar, Button, Card, Col, Empty, ErrorText, ListRow, Loading, Tabs, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";

/** Review queue for academy registrations. */
export default function AdminAcademies() {
  const t = useT();
  const [status, setStatus] = useState<AcademyStatus>("pending");
  const list = useQuery({ queryKey: ["admin", "academies", status], queryFn: () => api<AdminAcademyRow[]>(`/admin/academies?status=${status}`) });

  return (
    <>
      <Header
        title={t.admin.academies}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
        right={<Button kind="ghost" size="sm" title={t.notifications.refresh} onPress={() => list.refetch()} />}
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Col gap={4}>
          <Txt v="h1">{t.admin.verifyTitle}</Txt>
          <Txt muted>{t.admin.verifyText}</Txt>
        </Col>
        <View style={{ maxWidth: 420 }}>
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: t.admin.pendingTab },
              { value: "approved", label: t.admin.approvedTab },
              { value: "rejected", label: t.admin.rejectedTab },
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
                    {[[a.city, a.country].filter(Boolean).join(", "), a.requester ? t.admin.by(a.requester.name) : null, status === "pending" ? t.admin.submitted(ago(a.submittedAt)) : a.reviewedAt ? t.admin.reviewed(ago(a.reviewedAt)) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                </View>
              </ListRow>
            ))}
          </Card>
        ) : list.data ? (
          <Card>
            <Empty icon={Inbox} title={status === "pending" ? t.admin.nothingToReview : t.admin.noAcademies} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
