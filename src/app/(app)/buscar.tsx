import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Author } from "@/lib/types";
import { Avatar, Belt, Button, Card, Input, ListRow, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

export default function SearchPeople() {
  const t = useT();
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["users", q],
    queryFn: () => api<Author[]>(`/users?q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2,
  });
  return (
    <>
      <Header title={t.search.title} left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} />
      <Screen>
        <Input value={q} onChangeText={setQ} placeholder={t.search.placeholder} autoFocus autoCapitalize="none" />
        {results.isFetching ? <Loading /> : null}
        {results.data ? (
          <Card pad={false}>
            {results.data.map((u) => (
              <ListRow key={u.id} onPress={() => router.push(`/u/${u.username}`)}>
                <Avatar uri={u.avatarUrl} name={u.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{u.name}</Txt>
                  <Txt v="tiny" muted>@{u.username} · {t.belt[u.belt]}</Txt>
                </View>
                <Belt belt={u.belt} stripes={u.stripes} />
              </ListRow>
            ))}
            {results.data.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>{t.search.none}</Txt></View> : null}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
