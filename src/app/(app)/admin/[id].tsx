import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { type ReactNode, useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/lib/api";
import { ago, whenLong } from "@/lib/format";
import type { AdminAcademy } from "@/lib/types";
import { ACADEMY_STATUS_LABEL, REQUESTER_ROLE_LABEL } from "@/shared/domain";
import { Badge, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

function Field({ label, children, href }: { label: string; children: ReactNode; href?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt v="tiny" muted>{label}</Txt>
      {href ? (
        <Txt style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(href)}>{children}</Txt>
      ) : (
        <Txt>{children || "—"}</Txt>
      )}
    </View>
  );
}

/** One registration with everything needed to decide, plus approve / reject with a reason. */
export default function AdminAcademyReview() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin", "academy", id], queryFn: () => api<AdminAcademy>(`/admin/academies/${id}`) });
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function review(decision: "approve" | "reject") {
    setError(null);
    if (decision === "reject" && note.trim().length < 5) return setError("Escreva o motivo da recusa; o responsável vai ler.");
    setBusy(true);
    try {
      await api(`/admin/academies/${id}/review`, { method: "POST", json: { decision, note: note.trim() || undefined } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
      if (router.canGoBack()) router.back();
      else router.replace("/admin");
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const a = q.data;
  return (
    <>
      <Header
        title="Rever academia"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
      />
      <Screen wide>
        {q.isPending ? <Loading /> : null}
        <ErrorText error={q.error} />
        {a ? (
          <>
            <Card style={{ gap: space.sm }}>
              <Row wrap style={{ justifyContent: "space-between" }}>
                <Txt v="h1">{a.name}</Txt>
                <Badge tone={a.status === "pending" ? "accent" : a.status === "approved" ? "success" : "default"}>{ACADEMY_STATUS_LABEL[a.status]}</Badge>
              </Row>
              <Txt v="small" muted>
                Enviada {ago(a.submittedAt)} ({whenLong(a.submittedAt)})
                {a.reviewedAt ? ` · revista ${ago(a.reviewedAt)}` : ""}
              </Txt>
              {a.reviewNote ? <Txt v="small">Nota: {a.reviewNote}</Txt> : null}
            </Card>

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Academia" />
                <Col style={{ padding: space.lg }}>
                  <Field label="Equipe / filiação">{a.affiliation}</Field>
                  <Field label="Morada">{[a.address, a.postalCode, a.city, a.country].filter(Boolean).join(", ")}</Field>
                  <Field label="Telefone" href={a.phone ? `tel:${a.phone.replace(/[^+0-9]/g, "")}` : undefined}>{a.phone}</Field>
                  <Field label="E-mail" href={a.email ? `mailto:${a.email}` : undefined}>{a.email}</Field>
                  <Field label="Site" href={a.website ?? undefined}>{a.website}</Field>
                  <Field label="Instagram" href={a.instagram ? `https://instagram.com/${a.instagram}` : undefined}>{a.instagram ? `@${a.instagram}` : null}</Field>
                  <Field
                    label="Procurar no mapa"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.name, a.address, a.city].filter(Boolean).join(" "))}`}
                  >
                    Abrir no Google Maps
                  </Field>
                </Col>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Quem pediu" />
                <Col style={{ padding: space.lg }}>
                  {a.requester ? (
                    <>
                      <Field label="Nome">{a.requester.name}</Field>
                      {a.requester.username ? (
                        <Button size="sm" kind="ghost" title={`@${a.requester.username} — ver perfil`} onPress={() => router.push(`/u/${a.requester!.username}`)} style={{ alignSelf: "flex-start" }} />
                      ) : null}
                      <Field label="E-mail da conta" href={`mailto:${a.requester.email}`}>{a.requester.email}</Field>
                      <Field label="Conta criada">{`${ago(a.requester.accountCreatedAt)} · ${a.requester.sessions} treinos · ${a.requester.academiesRegistered} academia(s) cadastrada(s)`}</Field>
                    </>
                  ) : (
                    <Txt muted>A conta foi apagada.</Txt>
                  )}
                  <Field label="Papel declarado">{a.requesterRole ? REQUESTER_ROLE_LABEL[a.requesterRole] : null}</Field>
                  <Field label="Como confirmar">{a.proof}</Field>
                </Col>
              </Card>
            </Row>

            <Card pad={false}>
              <CardHead title="Academias parecidas" right={a.similar.length ? <Badge tone="accent">{String(a.similar.length)}</Badge> : undefined} />
              {a.similar.map((s) => (
                <ListRow key={s.id} onPress={() => router.push(`/admin/${s.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Txt bold>{s.name}</Txt>
                    <Txt v="tiny" muted>{[s.city, ACADEMY_STATUS_LABEL[s.status]].filter(Boolean).join(" · ")}</Txt>
                  </View>
                </ListRow>
              ))}
              {!a.similar.length ? (
                <View style={{ padding: space.lg }}>
                  <Txt v="small" muted>Nenhuma com o mesmo nome, telefone, site ou Instagram.</Txt>
                </View>
              ) : null}
            </Card>

            {a.status === "pending" ? (
              <Card style={{ gap: space.md }}>
                <Txt v="h3">Decisão</Txt>
                <Txt v="small" muted>
                  Antes de aprovar, confirme pelos canais oficiais (não pelos contactos de quem pediu) que essa pessoa
                  responde pela academia.
                </Txt>
                <Input label="Nota para o responsável (obrigatória ao recusar)" value={note} onChangeText={setNote} multiline placeholder="Ex.: Não conseguimos confirmar pelo Instagram oficial. Peça à academia para nos mandar mensagem." />
                <ErrorText error={error} />
                <Row gap={space.sm} wrap>
                  <Button kind="primary" icon={Check} title="Aprovar" loading={busy} onPress={() => review("approve")} />
                  <Button kind="danger" icon={X} title="Recusar" disabled={busy} onPress={() => review("reject")} />
                </Row>
              </Card>
            ) : (
              <Txt v="small" color={c.mutedFg}>Já revista. Se o responsável corrigir os dados, ela volta para a fila.</Txt>
            )}
          </>
        ) : null}
      </Screen>
    </>
  );
}
