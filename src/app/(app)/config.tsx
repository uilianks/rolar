import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Download from "lucide-react-native/icons/download";
import Heart from "lucide-react-native/icons/heart";
import LogOut from "lucide-react-native/icons/log-out";
import Trash2 from "lucide-react-native/icons/trash";
import { useState } from "react";
import { Linking, Platform, View } from "react-native";

import { api } from "@/lib/api";
import { API_URL, authClient } from "@/lib/auth-client";
import { confirm } from "@/lib/confirm";
import { useLocale, type LocalePref } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { beltOptions, VISIBILITIES, type Visibility } from "@/shared/domain";
import { LOCALES } from "@/shared/i18n";
import { AvatarEditor } from "@/ui/avatar-editor";
import { Button, Card, CardHead, Col, ErrorText, Input, ListRow, Row, Segmented, SwitchRow, Tabs, Txt } from "@/ui/kit";
import { Header, Screen, useWide } from "@/ui/shell";
import { space, useTheme, type ThemePref } from "@/ui/theme";

type Editable = Pick<Profile, "name" | "username" | "belt" | "stripes" | "startedAt" | "weeklyGoal" | "defaultVisibility" | "searchable" | "showInRanking">;

function pick({ name, username, belt, stripes, startedAt, weeklyGoal, defaultVisibility, searchable, showInRanking }: Editable): Editable {
  return { name, username, belt, stripes, startedAt, weeklyGoal, defaultVisibility, searchable, showInRanking };
}

export default function Settings() {
  const { c, pref, setPref } = useTheme();
  const { t, pref: localePref, setPref: setLocalePref } = useLocale();
  const wide = useWide();
  const qc = useQueryClient();
  const me = useMe().data;
  // Unsaved edits live in `draft`; until the first edit the form shows the stored profile.
  const [draft, setDraft] = useState<Editable | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form: Editable | null = draft ?? me?.profile ?? null;

  function set<K extends keyof Editable>(key: K, value: Editable[K]) {
    if (form) setDraft({ ...pick(form), [key]: value });
    setSaved(false);
  }

  async function save(patch: Partial<Editable> = form ? pick(form) : {}) {
    setError(null);
    try {
      // An empty "treina desde" clears it; single-field saves leave it untouched.
      const body = "startedAt" in patch ? { ...patch, startedAt: patch.startedAt || null } : patch;
      await api("/me/profile", { method: "PATCH", json: body });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setDraft(null);
      setSaved(true);
    } catch (e) {
      setError(e);
    }
  }

  async function applyToPast(visibility: Visibility) {
    if (!(await confirm(t.settings.applyOldTitle, t.settings.applyOldText(t.visibility[visibility]), t.settings.apply))) return;
    const res = await api<{ updated: number }>("/me/sessions/visibility", { method: "POST", json: { visibility } });
    await qc.invalidateQueries({ queryKey: ["feed"] });
    setError(null);
    setSaved(false);
    if (Platform.OS === "web") window.alert(`${res.updated} treinos atualizados.`);
  }

  async function exportData() {
    if (Platform.OS === "web") {
      const data = await api("/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "rolar-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Linking.openURL(`${API_URL}/api/me/export`);
    }
  }

  async function signOut() {
    await authClient.signOut();
    qc.clear();
  }

  async function deleteAccount() {
    if (!(await confirm(t.settings.deleteAccountTitle, t.settings.deleteAccountText, t.settings.deleteAll))) return;
    await api("/me", { method: "DELETE" });
    await authClient.signOut().catch(() => undefined);
    qc.clear();
  }

  return (
    <>
      <Header
        title={t.nav.settings}
        left={wide ? undefined : <Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/perfil"))} />}
      />
      <Screen>
        {form ? (
          <Card pad={false}>
            <CardHead title={t.nav.profile} right={saved ? <Txt v="small" color={c.success}>{t.settings.saved}</Txt> : null} />
            <Col style={{ padding: space.lg }}>
              <AvatarEditor />
              <Input label={t.onboarding.name} value={form.name} onChangeText={(v) => set("name", v)} />
              <Input label={t.onboarding.username} value={form.username} autoCapitalize="none" onChangeText={(v) => set("username", v.toLowerCase())} />
              <Segmented label={t.profile.belt} value={form.belt} onChange={(v) => set("belt", v)} options={beltOptions(me?.profile?.birthYear, form.belt).map((b) => ({ value: b, label: t.belt[b] }))} />
              <Segmented label={t.profile.stripes} value={form.stripes} onChange={(v) => set("stripes", v)} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
              <Input label={t.onboarding.startedAt} value={form.startedAt ?? ""} onChangeText={(v) => set("startedAt", v)} />
              <Segmented label={t.onboarding.weeklyGoal} value={form.weeklyGoal} onChange={(v) => set("weeklyGoal", v)} options={[0, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n ? String(n) : t.onboarding.noGoal }))} />
              <ErrorText error={error} />
              <Button kind="primary" title={t.settings.saveProfile} onPress={() => save()} />
            </Col>
          </Card>
        ) : null}

        {form ? (
          <Card pad={false}>
            <CardHead title={t.settings.privacy} />
            <View style={{ padding: space.lg }}>
              <Segmented
                label={t.settings.defaultVisibility}
                value={form.defaultVisibility}
                onChange={(v) => {
                  set("defaultVisibility", v);
                  void save({ defaultVisibility: v });
                }}
                options={VISIBILITIES.map((v) => ({ value: v, label: t.visibility[v] }))}
              />
            </View>
            <SwitchRow title={t.settings.searchable} hint={t.settings.searchableHint} value={form.searchable} onChange={(v) => { set("searchable", v); void save({ searchable: v }); }} />
            <SwitchRow title={t.settings.ranking} value={form.showInRanking} onChange={(v) => { set("showInRanking", v); void save({ showInRanking: v }); }} />
            <ListRow onPress={() => applyToPast(form.defaultVisibility)}>
              <View style={{ flex: 1 }}>
                <Txt bold>{t.settings.applyOld}</Txt>
                <Txt v="tiny" muted>{t.settings.applyOldHint(t.visibility[form.defaultVisibility])}</Txt>
              </View>
            </ListRow>
          </Card>
        ) : null}

        <Card pad={false}>
          <CardHead title={t.settings.preferences} />
          <ListRow>
            <Txt style={{ flex: 1 }}>{t.settings.theme}</Txt>
            <View style={{ width: 220 }}>
              <Tabs<ThemePref> value={pref} onChange={setPref} options={[{ value: "light", label: t.settings.light }, { value: "dark", label: t.settings.dark }, { value: "system", label: t.settings.system }]} />
            </View>
          </ListRow>
          <ListRow>
            <Txt style={{ flex: 1 }}>{t.settings.language}</Txt>
            <View style={{ width: 220 }}>
              <Tabs<LocalePref> value={localePref} onChange={setLocalePref} options={[...LOCALES.map((l) => ({ value: l, label: t.languageName[l] })), { value: "system", label: t.settings.system }]} />
            </View>
          </ListRow>
        </Card>

        {/* Wide screens show this in the sidebar; phones have no sidebar, so it lives here. */}
        {wide ? null : (
          <Card style={{ gap: 8 }}>
            <Row>
              <Heart size={16} color={c.fg} />
              <Txt bold>{t.nav.support}</Txt>
            </Row>
            <Txt v="small" muted>{t.nav.openSourceText}</Txt>
            <Button size="sm" title={t.nav.donate} onPress={() => router.push("/apoie")} />
          </Card>
        )}

        <Card pad={false}>
          <CardHead title={t.settings.yourData} />
          <ListRow onPress={exportData}>
            <Download size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>{t.settings.download}</Txt>
          </ListRow>
          <ListRow onPress={() => router.push("/privacidade")}>
            <Txt style={{ flex: 1 }}>{t.legal.privacyTitle}</Txt>
          </ListRow>
          <ListRow onPress={() => router.push("/termos")}>
            <Txt style={{ flex: 1 }}>{t.legal.termsTitle}</Txt>
          </ListRow>
          <ListRow onPress={signOut}>
            <LogOut size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>{t.onboarding.signOut}</Txt>
          </ListRow>
          <ListRow onPress={deleteAccount}>
            <Trash2 size={18} color={c.accent} />
            <Txt style={{ flex: 1 }} color={c.accent}>{t.settings.deleteAccount}</Txt>
          </ListRow>
        </Card>
        <Row>
          <Txt v="tiny" muted>{me?.user.email} · rolar v0.1 · open source (AGPL-3.0)</Txt>
        </Row>
      </Screen>
    </>
  );
}
