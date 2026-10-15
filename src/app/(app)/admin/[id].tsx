import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import ArrowRightLeft from "lucide-react-native/icons/arrow-right-left";
import Pencil from "lucide-react-native/icons/pencil";
import X from "lucide-react-native/icons/x";
import { type ReactNode, useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
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

const EDITABLE = [
  ["name", "Nome"],
  ["affiliation", "Equipe / filiação"],
  ["address", "Morada"],
  ["postalCode", "Código postal"],
  ["city", "Cidade"],
  ["country", "País (2 letras)"],
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["website", "Site"],
  ["instagram", "Instagram"],
] as const;
type EditableKey = (typeof EDITABLE)[number][0];

/** Admin correction of the academy's details, at any status (the address of its page stays the same). */
function EditAcademy({ a, onDone }: { a: AdminAcademy; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<EditableKey, string>>(() => Object.fromEntries(EDITABLE.map(([k]) => [k, a[k] ?? ""])) as Record<EditableKey, string>);
  const [error, setError] = useState<unknown>(null);

  async function save() {
    setError(null);
    try {
      await api(`/admin/academies/${a.id}`, { method: "PATCH", json: form });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      onDone();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Col style={{ padding: space.lg }}>
      {EDITABLE.map(([k, label]) => (
        <Input key={k} label={label} value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} autoCapitalize={k === "name" || k === "address" || k === "city" || k === "affiliation" ? "sentences" : "none"} />
      ))}
      <ErrorText error={error} />
      <Row>
        <Button kind="primary" title="Salvar dados" onPress={save} />
        <Button kind="ghost" title="Cancelar" onPress={onDone} />
      </Row>
    </Col>
  );
}

/** Who answers for the academy, and handing it over to another account. */
function Ownership({ a }: { a: AdminAcademy }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<unknown>(null);

  async function transfer() {
    setError(null);
    const target = username.trim().replace(/^@/, "").toLowerCase();
    if (!target) return setError("Informe o nome de usuário do novo responsável.");
    if (!(await confirm(`Transferir para @${target}?`, "O responsável atual passa a professor da academia.", "Transferir"))) return;
    try {
      await api(`/admin/academies/${a.id}/owner`, { method: "POST", json: { username: target } });
      setUsername("");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Col style={{ padding: space.lg }}>
      {a.owner ? (
        <Field label="Responsável atual">
          <Txt style={{ textDecorationLine: "underline" }} onPress={() => router.push(`/admin/usuario/${a.owner!.id}`)}>
            {a.owner.name} (@{a.owner.username})
          </Txt>
        </Field>
      ) : (
        <Field label="Responsável atual">Ninguém (a conta foi apagada)</Field>
      )}
      <Input label="Transferir para (nome de usuário)" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@professor" />
      <ErrorText error={error} />
      <Button icon={ArrowRightLeft} title="Transferir academia" onPress={transfer} style={{ alignSelf: "flex-start" }} />
    </Col>
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
  const [editing, setEditing] = useState(false);

  async function review(decision: "approve" | "reject") {
    setError(null);
    if (decision === "reject" && note.trim().length < 5) return setError("Escreva o motivo da recusa; o responsável vai ler.");
    setBusy(true);
    try {
      await api(`/admin/academies/${id}/review`, { method: "POST", json: { decision, note: note.trim() || undefined } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
      if (router.canGoBack()) router.back();
      else router.replace("/admin/academias");
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
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/academias"))} />}
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

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Dados da academia" right={editing ? undefined : <Button size="sm" kind="ghost" icon={Pencil} title="Editar" onPress={() => setEditing(true)} />} />
                {editing ? (
                  <EditAcademy a={a} onDone={() => setEditing(false)} />
                ) : (
                  <View style={{ padding: space.lg }}>
                    <Txt v="small" muted>Corrija nome, morada ou contactos sem mandar a academia de volta para a fila.</Txt>
                  </View>
                )}
              </Card>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Responsável" />
                <Ownership a={a} />
              </Card>
            </Row>

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
