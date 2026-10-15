import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Ban from "lucide-react-native/icons/ban";
import ImageOff from "lucide-react-native/icons/image-off";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { ago, whenLong } from "@/lib/format";
import type { AdminUser } from "@/lib/types";
import { BELT_LABEL } from "@/shared/domain";
import { Avatar, Badge, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

/** One account: what an admin needs for support and moderation, and the actions on it. */
export default function AdminUserPage() {
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin", "user", id], queryFn: () => api<AdminUser>(`/admin/users/${id}`) });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function run(path: string, init: Parameters<typeof api>[1]) {
    setError(null);
    setBusy(true);
    try {
      await api(path, init);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (reason.trim().length < 5) return setError("Escreva o motivo; a pessoa vai ler ao tentar entrar.");
    if (!(await confirm("Suspender conta?", "A pessoa sai de todos os aparelhos, não consegue entrar e o conteúdo dela some para os outros.", "Suspender"))) return;
    await run(`/admin/users/${id}/suspend`, { method: "POST", json: { reason: reason.trim() } });
  }

  async function removePhoto() {
    if (!(await confirm("Remover foto de perfil?", "A pessoa é avisada e pode enviar outra.", "Remover"))) return;
    await run(`/admin/users/${id}/avatar`, { method: "DELETE" });
  }

  const u = q.data;
  const p = u?.profile;
  return (
    <>
      <Header
        title="Conta"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/usuarios"))} />}
      />
      <Screen>
        {q.isPending ? <Loading /> : null}
        <ErrorText error={q.error} />
        {u ? (
          <>
            <Card style={{ gap: space.md }}>
              <Row gap={space.md}>
                <Avatar uri={p?.avatarUrl} name={p?.name ?? u.email} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="h2">{p?.name ?? "Sem perfil"}</Txt>
                  <Txt v="small" muted>{[p ? `@${p.username}` : null, u.email].filter(Boolean).join(" · ")}</Txt>
                </View>
                {u.isAdmin ? <Badge>Admin</Badge> : null}
                {u.suspendedAt ? <Badge tone="accent">Suspensa</Badge> : null}
              </Row>
              <Txt v="small" muted>
                {[
                  `Conta criada ${ago(u.createdAt)} (${whenLong(u.createdAt)})`,
                  p ? `${BELT_LABEL[p.belt]}${p.stripes ? `, ${p.stripes} grau(s)` : ""}` : null,
                  p?.minor ? "menor de idade" : null,
                  `${u.sessions} treinos`,
                  `${u.followers} seguidores`,
                  u.reports ? `${u.reports} denúncia(s) do perfil` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
              {p && !u.suspendedAt ? (
                <Button size="sm" kind="ghost" title="Ver perfil público" onPress={() => router.push(`/u/${p.username}`)} style={{ alignSelf: "flex-start" }} />
              ) : null}
            </Card>

            {u.memberships.length ? (
              <Card pad={false}>
                <CardHead title="Academias" />
                {u.memberships.map((m) => (
                  <ListRow key={m.id} onPress={() => router.push(`/admin/${m.id}`)}>
                    <Txt bold style={{ flex: 1 }}>{m.name}</Txt>
                    <Txt v="tiny" muted>{m.status === "pending" ? "pedido pendente" : m.role === "owner" ? "responsável" : m.role === "coach" ? "professor" : "aluno"}</Txt>
                  </ListRow>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Txt v="h3">Moderação</Txt>
              {u.suspendedAt ? (
                <Col gap={space.sm}>
                  <Txt v="small">
                    Suspensa {ago(u.suspendedAt)}. Motivo: {u.suspensionReason}
                  </Txt>
                  <Button icon={RotateCcw} title="Reativar conta" loading={busy} onPress={() => run(`/admin/users/${id}/suspend`, { method: "DELETE" })} style={{ alignSelf: "flex-start" }} />
                </Col>
              ) : u.isAdmin ? (
                <Txt v="small" muted>Administradores não podem ser suspensos.</Txt>
              ) : (
                <>
                  <Input label="Motivo da suspensão (a pessoa vê ao tentar entrar)" value={reason} onChangeText={setReason} multiline />
                  <Row gap={space.sm} wrap>
                    <Button kind="danger" icon={Ban} title="Suspender conta" loading={busy} onPress={suspend} />
                    {p?.avatarUrl ? <Button kind="danger" icon={ImageOff} title="Remover foto" disabled={busy} onPress={removePhoto} /> : null}
                  </Row>
                </>
              )}
              <ErrorText error={error} />
            </Card>
          </>
        ) : null}
      </Screen>
    </>
  );
}
