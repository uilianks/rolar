import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Users from "lucide-react-native/icons/users";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AdminUserRow } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, ErrorText, Input, ListRow, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";

/** Account lookup for support and moderation; without a search it lists the newest accounts. */
export default function AdminUsers() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  // Search after a short pause in typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const list = useQuery({ queryKey: ["admin", "users", q], queryFn: () => api<AdminUserRow[]>(`/admin/users?q=${encodeURIComponent(q)}`) });

  return (
    <>
      <Header
        title={t.admin.accounts}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
      />
      <Screen onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Input value={query} onChangeText={setQuery} placeholder={t.admin.usersSearch} autoCapitalize="none" />
        {!q ? <Txt v="small" muted>{t.admin.recentAccounts}</Txt> : null}
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        {list.data?.length ? (
          <Card pad={false}>
            {list.data.map((u) => (
              <ListRow key={u.id} onPress={() => router.push(`/admin/usuario/${u.id}`)}>
                <Avatar uri={u.avatarUrl} name={u.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{u.name}</Txt>
                  <Txt v="tiny" muted>
                    {[u.username ? `@${u.username}` : t.admin.noProfileShort, u.email, t.admin.created(ago(u.createdAt))].join(" · ")}
                  </Txt>
                </View>
                {u.suspendedAt ? <Badge tone="accent">{t.admin.suspended}</Badge> : null}
              </ListRow>
            ))}
          </Card>
        ) : list.data ? (
          <Card>
            <Empty icon={Users} title={t.admin.noAccounts} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
