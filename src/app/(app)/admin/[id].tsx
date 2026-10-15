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
import { useT } from "@/lib/i18n";
import type { AdminAcademy } from "@/lib/types";
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

const EDITABLE = ["name", "affiliation", "address", "postalCode", "city", "country", "phone", "email", "website", "instagram"] as const;
type EditableKey = (typeof EDITABLE)[number];

/** Admin correction of the academy's details, at any status (the address of its page stays the same). */
function EditAcademy({ a, onDone }: { a: AdminAcademy; onDone: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<EditableKey, string>>(() => Object.fromEntries(EDITABLE.map((k) => [k, a[k] ?? ""])) as Record<EditableKey, string>);
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
      {EDITABLE.map((k) => (
        <Input key={k} label={t.admin.field[k]} value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} autoCapitalize={k === "name" || k === "address" || k === "city" || k === "affiliation" ? "sentences" : "none"} />
      ))}
      <ErrorText error={error} />
      <Row>
        <Button kind="primary" title={t.admin.saveData} onPress={save} />
        <Button kind="ghost" title={t.common.cancel} onPress={onDone} />
      </Row>
    </Col>
  );
}

/** Who answers for the academy, and handing it over to another account. */
function Ownership({ a }: { a: AdminAcademy }) {
  const t = useT();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<unknown>(null);

  async function transfer() {
    setError(null);
    const target = username.trim().replace(/^@/, "").toLowerCase();
    if (!target) return setError(t.admin.newOwnerRequired);
    if (!(await confirm(t.admin.transferTitle(target), t.admin.transferText, t.admin.transfer))) return;
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
        <Field label={t.admin.currentOwner}>
          <Txt style={{ textDecorationLine: "underline" }} onPress={() => router.push(`/admin/usuario/${a.owner!.id}`)}>
            {a.owner.name} (@{a.owner.username})
          </Txt>
        </Field>
      ) : (
        <Field label={t.admin.currentOwner}>{t.admin.ownerDeleted}</Field>
      )}
      <Input label={t.admin.transferTo} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@professor" />
      <ErrorText error={error} />
      <Button icon={ArrowRightLeft} title={t.admin.transferAcademy} onPress={transfer} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
}

/** One registration with everything needed to decide, plus approve / reject with a reason. */
export default function AdminAcademyReview() {
  const t = useT();
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
    if (decision === "reject" && note.trim().length < 5) return setError(t.admin.writeRejectReason);
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
        title={t.admin.reviewAcademy}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/academias"))} />}
      />
      <Screen wide>
        {q.isPending ? <Loading /> : null}
        <ErrorText error={q.error} />
        {a ? (
          <>
            <Card style={{ gap: space.sm }}>
              <Row wrap style={{ justifyContent: "space-between" }}>
                <Txt v="h1">{a.name}</Txt>
                <Badge tone={a.status === "pending" ? "accent" : a.status === "approved" ? "success" : "default"}>{t.academyStatus[a.status]}</Badge>
              </Row>
              <Txt v="small" muted>
                {t.admin.submittedLong(ago(a.submittedAt), whenLong(a.submittedAt))}
                {a.reviewedAt ? ` · ${t.admin.reviewed(ago(a.reviewedAt))}` : ""}
              </Txt>
              {a.reviewNote ? <Txt v="small">{t.admin.note(a.reviewNote)}</Txt> : null}
            </Card>

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.nav.academy} />
                <Col style={{ padding: space.lg }}>
                  <Field label={t.admin.field.affiliation}>{a.affiliation}</Field>
                  <Field label={t.admin.field.address}>{[a.address, a.postalCode, a.city, a.country].filter(Boolean).join(", ")}</Field>
                  <Field label={t.admin.field.phone} href={a.phone ? `tel:${a.phone.replace(/[^+0-9]/g, "")}` : undefined}>{a.phone}</Field>
                  <Field label={t.admin.field.email} href={a.email ? `mailto:${a.email}` : undefined}>{a.email}</Field>
                  <Field label={t.admin.field.website} href={a.website ?? undefined}>{a.website}</Field>
                  <Field label="Instagram" href={a.instagram ? `https://instagram.com/${a.instagram}` : undefined}>{a.instagram ? `@${a.instagram}` : null}</Field>
                  <Field
                    label={t.admin.searchMap}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.name, a.address, a.city].filter(Boolean).join(" "))}`}
                  >
                    {t.admin.openGoogleMaps}
                  </Field>
                </Col>
              </Card>

              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.admin.requester} />
                <Col style={{ padding: space.lg }}>
                  {a.requester ? (
                    <>
                      <Field label={t.admin.field.name}>{a.requester.name}</Field>
                      {a.requester.username ? (
                        <Button size="sm" kind="ghost" title={t.admin.seeProfile(a.requester.username)} onPress={() => router.push(`/u/${a.requester!.username}`)} style={{ alignSelf: "flex-start" }} />
                      ) : null}
                      <Field label={t.admin.accountEmail} href={`mailto:${a.requester.email}`}>{a.requester.email}</Field>
                      <Field label={t.admin.accountCreated}>{`${ago(a.requester.accountCreatedAt)} · ${t.feed.sessions(a.requester.sessions)} · ${t.admin.academiesRegistered(a.requester.academiesRegistered)}`}</Field>
                    </>
                  ) : (
                    <Txt muted>{t.admin.accountDeleted}</Txt>
                  )}
                  <Field label={t.admin.declaredRole}>{a.requesterRole ? t.requesterRole[a.requesterRole] : null}</Field>
                  <Field label={t.admin.howToConfirm}>{a.proof}</Field>
                </Col>
              </Card>
            </Row>

            <Card pad={false}>
              <CardHead title={t.admin.similar} right={a.similar.length ? <Badge tone="accent">{String(a.similar.length)}</Badge> : undefined} />
              {a.similar.map((s) => (
                <ListRow key={s.id} onPress={() => router.push(`/admin/${s.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Txt bold>{s.name}</Txt>
                    <Txt v="tiny" muted>{[s.city, t.academyStatus[s.status]].filter(Boolean).join(" · ")}</Txt>
                  </View>
                </ListRow>
              ))}
              {!a.similar.length ? (
                <View style={{ padding: space.lg }}>
                  <Txt v="small" muted>{t.admin.noSimilar}</Txt>
                </View>
              ) : null}
            </Card>

            <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.admin.academyData} right={editing ? undefined : <Button size="sm" kind="ghost" icon={Pencil} title={t.common.edit} onPress={() => setEditing(true)} />} />
                {editing ? (
                  <EditAcademy a={a} onDone={() => setEditing(false)} />
                ) : (
                  <View style={{ padding: space.lg }}>
                    <Txt v="small" muted>{t.admin.editHint}</Txt>
                  </View>
                )}
              </Card>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.academy.role.owner} />
                <Ownership a={a} />
              </Card>
            </Row>

            {a.status === "pending" ? (
              <Card style={{ gap: space.md }}>
                <Txt v="h3">{t.admin.decision}</Txt>
                <Txt v="small" muted>
                  {t.admin.decisionHint}
                </Txt>
                <Input label={t.admin.ownerNote} value={note} onChangeText={setNote} multiline placeholder={t.admin.ownerNotePlaceholder} />
                <ErrorText error={error} />
                <Row gap={space.sm} wrap>
                  <Button kind="primary" icon={Check} title={t.admin.approve} loading={busy} onPress={() => review("approve")} />
                  <Button kind="danger" icon={X} title={t.academy.decline} disabled={busy} onPress={() => review("reject")} />
                </Row>
              </Card>
            ) : (
              <Txt v="small" color={c.mutedFg}>{t.admin.alreadyReviewed}</Txt>
            )}
          </>
        ) : null}
      </Screen>
    </>
  );
}
