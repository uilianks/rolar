import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ToggleRight from "lucide-react-native/icons/toggle-right";
import { useState } from "react";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { useT } from "@/lib/i18n";
import type { AdminFlag } from "@/lib/types";
import { Button, Card, Col, Empty, ErrorText, Input, Loading, Row, SwitchRow, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

/** "@ana, bia" → ["ana", "bia"] */
const parseUsernames = (text: string) => text.split(/[\s,]+/).map((u) => u.replace(/^@/, "").toLowerCase()).filter(Boolean);

/** Edits one flag; a new one starts from an empty key. */
function FlagForm({ flag, onDone }: { flag?: AdminFlag; onDone?: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [key, setKey] = useState(flag?.key ?? "");
  const [all, setAll] = useState(flag?.enabledForAll ?? false);
  const [users, setUsers] = useState(flag?.usernames.map((u) => `@${u}`).join(", ") ?? "");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await api(`/admin/flags/${encodeURIComponent(key.trim())}`, { method: "PUT", json: { enabledForAll: all, usernames: parseUsernames(users) } });
      await qc.invalidateQueries({ queryKey: ["admin", "flags"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError(e);
    }
  }

  async function remove() {
    if (!(await confirm(t.admin.deleteFlagTitle(flag!.key), t.admin.deleteFlagText, t.academyCards.deleteAction))) return;
    try {
      await api(`/admin/flags/${encodeURIComponent(flag!.key)}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["admin", "flags"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      {flag ? <Txt v="h3">{flag.key}</Txt> : <Input label={t.admin.flagKey} value={key} onChangeText={setKey} autoCapitalize="none" placeholder="timer-v2" />}
      <SwitchRow title={t.admin.flagAll} value={all} onChange={setAll} />
      {!all ? <Input label={t.admin.flagUsers} value={users} onChangeText={setUsers} autoCapitalize="none" placeholder="@ana, @bia" /> : null}
      <ErrorText error={error} />
      <Row gap={space.sm}>
        <Button kind="primary" title={flag ? t.common.save : t.admin.createFlag} onPress={save} />
        {flag ? <Button kind="ghost" title={t.academyCards.deleteAction} onPress={remove} /> : null}
        {saved ? <Txt v="small" muted>{t.settings.saved}</Txt> : null}
      </Row>
    </Card>
  );
}

/** Feature flags: the app reads the keys enabled for the signed-in user from /me (`flags`). */
export default function AdminFlags() {
  const t = useT();
  const list = useQuery({ queryKey: ["admin", "flags"], queryFn: () => api<AdminFlag[]>("/admin/flags") });
  const [adding, setAdding] = useState(false);

  return (
    <>
      <Header
        title={t.admin.flags}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} />}
        right={adding ? undefined : <Button kind="ghost" size="sm" title={t.admin.newFlag} onPress={() => setAdding(true)} />}
      />
      <Screen>
        <Txt muted>{t.admin.flagsIntro}</Txt>
        {adding ? <FlagForm onDone={() => setAdding(false)} /> : null}
        {list.isPending ? <Loading /> : null}
        <ErrorText error={list.error} />
        <Col>
          {list.data?.map((f) => <FlagForm key={`${f.key}:${f.enabledForAll}:${f.usernames.join()}`} flag={f} />)}
        </Col>
        {list.data && !list.data.length && !adding ? (
          <Card>
            <Empty icon={ToggleRight} title={t.admin.noFlags} text={t.admin.noFlagsText} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
