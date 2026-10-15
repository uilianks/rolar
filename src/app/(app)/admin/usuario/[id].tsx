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
import { useT } from "@/lib/i18n";
import type { AdminUser } from "@/lib/types";
import { Avatar, Badge, Button, Card, CardHead, Col, ErrorText, Input, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

/** One account: what an admin needs for support and moderation, and the actions on it. */
export default function AdminUserPage() {
  const t = useT();
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
    if (reason.trim().length < 5) return setError(t.admin.writeSuspendReason);
    if (!(await confirm(t.admin.suspendTitle, t.admin.suspendText, t.admin.suspendAction))) return;
    await run(`/admin/users/${id}/suspend`, { method: "POST", json: { reason: reason.trim() } });
  }

  async function removePhoto() {
    if (!(await confirm(t.admin.removePhotoTitle, t.admin.removePhotoText, t.common.remove))) return;
    await run(`/admin/users/${id}/avatar`, { method: "DELETE" });
  }

  const u = q.data;
  const p = u?.profile;
  return (
    <>
      <Header
        title={t.admin.account}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/usuarios"))} />}
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
                  <Txt v="h2">{p?.name ?? t.admin.noProfile}</Txt>
                  <Txt v="small" muted>{[p ? `@${p.username}` : null, u.email].filter(Boolean).join(" · ")}</Txt>
                </View>
                {u.isAdmin ? <Badge>{t.nav.admin}</Badge> : null}
                {u.suspendedAt ? <Badge tone="accent">{t.admin.suspended}</Badge> : null}
              </Row>
              <Txt v="small" muted>
                {[
                  t.admin.accountCreatedLong(ago(u.createdAt), whenLong(u.createdAt)),
                  p ? `${t.belt[p.belt]}${p.stripes ? `, ${t.profile.stripeCount(p.stripes)}` : ""}` : null,
                  p?.minor ? t.admin.minor : null,
                  t.feed.sessions(u.sessions),
                  t.admin.followers(u.followers),
                  u.reports ? t.admin.profileReports(u.reports) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
              {p && !u.suspendedAt ? (
                <Button size="sm" kind="ghost" title={t.admin.publicProfile} onPress={() => router.push(`/u/${p.username}`)} style={{ alignSelf: "flex-start" }} />
              ) : null}
            </Card>

            {u.memberships.length ? (
              <Card pad={false}>
                <CardHead title={t.admin.academies} />
                {u.memberships.map((m) => (
                  <ListRow key={m.id} onPress={() => router.push(`/admin/${m.id}`)}>
                    <Txt bold style={{ flex: 1 }}>{m.name}</Txt>
                    <Txt v="tiny" muted>{m.status === "pending" ? t.admin.pendingRequest : t.academy.role[m.role].toLowerCase()}</Txt>
                  </ListRow>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Txt v="h3">{t.admin.moderation}</Txt>
              {u.suspendedAt ? (
                <Col gap={space.sm}>
                  <Txt v="small">
                    {t.admin.suspendedSince(ago(u.suspendedAt), u.suspensionReason ?? "")}
                  </Txt>
                  <Button icon={RotateCcw} title={t.admin.reactivate} loading={busy} onPress={() => run(`/admin/users/${id}/suspend`, { method: "DELETE" })} style={{ alignSelf: "flex-start" }} />
                </Col>
              ) : u.isAdmin ? (
                <Txt v="small" muted>{t.admin.adminsNotSuspended}</Txt>
              ) : (
                <>
                  <Input label={t.admin.suspendReason} value={reason} onChangeText={setReason} multiline />
                  <Row gap={space.sm} wrap>
                    <Button kind="danger" icon={Ban} title={t.admin.suspend} loading={busy} onPress={suspend} />
                    {p?.avatarUrl ? <Button kind="danger" icon={ImageOff} title={t.admin.removePhoto} disabled={busy} onPress={removePhoto} /> : null}
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
