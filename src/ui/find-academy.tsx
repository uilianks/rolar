import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import type { Academy } from "@/lib/types";

import { Avatar, Button, Card, CardHead, Col, Input, ListRow, Loading, Txt } from "./kit";
import { Header, Screen } from "./shell";
import { space } from "./theme";

/** Search academies or register one; used when the user has no academy and from "Buscar". */
export function FindAcademy({ back }: { back?: boolean }) {
  const [q, setQ] = useState("");
  const results = useQuery({ queryKey: ["academies", q], queryFn: () => api<Academy[]>(`/academies?q=${encodeURIComponent(q)}`) });

  return (
    <>
      <Header
        title="Academia"
        left={back ? <Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/academia"))} /> : undefined}
      />
      <Screen>
        <Col gap={4}>
          <Txt v="h1">Encontre a sua academia</Txt>
          <Txt muted>Peça para entrar e o professor aprova. Se ela ainda não estiver aqui, o responsável pode cadastrá-la.</Txt>
        </Col>
        <Input value={q} onChangeText={setQ} placeholder="Buscar por nome ou cidade" />
        <Card pad={false}>
          {results.isPending ? <Loading /> : null}
          {(results.data ?? []).map((a) => (
            <ListRow key={a.id} onPress={() => router.push(`/academia/${a.id}`)}>
              <Avatar name={a.name} size={32} square />
              <View style={{ flex: 1 }}>
                <Txt bold>{a.name}</Txt>
                <Txt v="tiny" muted>{[a.city, `${a.memberCount} membros`].filter(Boolean).join(" · ")}</Txt>
              </View>
            </ListRow>
          ))}
          {results.data?.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>Nenhuma academia encontrada.</Txt></View> : null}
        </Card>
        <Card pad={false}>
          <CardHead title="É responsável por uma academia?" />
          <Col style={{ padding: space.lg }}>
            <Txt v="small" muted>Cadastre-a com os dados de contacto oficiais. Depois de verificada, ela aparece na busca e você aprova os alunos.</Txt>
            <Button kind="primary" icon={Plus} title="Cadastrar academia" onPress={() => router.push("/academia/nova")} />
          </Col>
        </Card>
      </Screen>
    </>
  );
}
