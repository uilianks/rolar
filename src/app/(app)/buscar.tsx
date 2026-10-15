import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import type { Author } from "@/lib/types";
import { BELT_LABEL } from "@/shared/domain";
import { Avatar, Belt, Button, Card, Input, ListRow, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

export default function SearchPeople() {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["users", q],
    queryFn: () => api<Author[]>(`/users?q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2,
  });
  return (
    <>
      <Header title="Buscar pessoas" left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} />
      <Screen>
        <Input value={q} onChangeText={setQ} placeholder="Nome ou @usuário" autoFocus autoCapitalize="none" />
        {results.isFetching ? <Loading /> : null}
        {results.data ? (
          <Card pad={false}>
            {results.data.map((u) => (
              <ListRow key={u.id} onPress={() => router.push(`/u/${u.username}`)}>
                <Avatar name={u.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{u.name}</Txt>
                  <Txt v="tiny" muted>@{u.username} · {BELT_LABEL[u.belt]}</Txt>
                </View>
                <Belt belt={u.belt} stripes={u.stripes} />
              </ListRow>
            ))}
            {results.data.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>Ninguém encontrado.</Txt></View> : null}
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
