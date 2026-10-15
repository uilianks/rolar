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
import { useMe } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { BELT_LABEL, beltOptions, VISIBILITY_LABEL, VISIBILITIES, type Visibility } from "@/shared/domain";
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
    if (!(await confirm("Mudar treinos antigos?", `Todos os seus treinos passam a ser visíveis para: ${VISIBILITY_LABEL[visibility]}.`, "Aplicar"))) return;
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
    if (!(await confirm("Apagar conta?", "Todos os seus treinos, comentários, graduações e dados serão apagados para sempre.", "Apagar tudo"))) return;
    await api("/me", { method: "DELETE" });
    await authClient.signOut().catch(() => undefined);
    qc.clear();
  }

  return (
    <>
      <Header
        title="Configurações"
        left={wide ? undefined : <Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/perfil"))} />}
      />
      <Screen>
        {form ? (
          <Card pad={false}>
            <CardHead title="Perfil" right={saved ? <Txt v="small" color={c.success}>Salvo</Txt> : null} />
            <Col style={{ padding: space.lg }}>
              <AvatarEditor />
              <Input label="Nome" value={form.name} onChangeText={(t) => set("name", t)} />
              <Input label="Nome de usuário" value={form.username} autoCapitalize="none" onChangeText={(t) => set("username", t.toLowerCase())} />
              <Segmented label="Faixa" value={form.belt} onChange={(v) => set("belt", v)} options={beltOptions(me?.profile?.birthYear, form.belt).map((b) => ({ value: b, label: BELT_LABEL[b] }))} />
              <Segmented label="Graus" value={form.stripes} onChange={(v) => set("stripes", v)} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
              <Input label="Treina desde (AAAA-MM)" value={form.startedAt ?? ""} onChangeText={(t) => set("startedAt", t)} />
              <Segmented label="Meta de treinos por semana" value={form.weeklyGoal} onChange={(v) => set("weeklyGoal", v)} options={[0, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n ? String(n) : "Sem meta" }))} />
              <ErrorText error={error} />
              <Button kind="primary" title="Salvar perfil" onPress={() => save()} />
            </Col>
          </Card>
        ) : null}

        {form ? (
          <Card pad={false}>
            <CardHead title="Privacidade" />
            <View style={{ padding: space.lg }}>
              <Segmented
                label="Visibilidade padrão dos treinos"
                value={form.defaultVisibility}
                onChange={(v) => {
                  set("defaultVisibility", v);
                  void save({ defaultVisibility: v });
                }}
                options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
              />
            </View>
            <SwitchRow title="Aparecer na busca e nas sugestões" hint="Menores de 18 nunca aparecem na busca" value={form.searchable} onChange={(v) => { set("searchable", v); void save({ searchable: v }); }} />
            <SwitchRow title="Aparecer no ranking da academia" value={form.showInRanking} onChange={(v) => { set("showInRanking", v); void save({ showInRanking: v }); }} />
            <ListRow onPress={() => applyToPast(form.defaultVisibility)}>
              <View style={{ flex: 1 }}>
                <Txt bold>Aplicar a visibilidade padrão aos treinos antigos</Txt>
                <Txt v="tiny" muted>Muda todos os treinos já registrados para “{VISIBILITY_LABEL[form.defaultVisibility]}”</Txt>
              </View>
            </ListRow>
          </Card>
        ) : null}

        <Card pad={false}>
          <CardHead title="Preferências" />
          <ListRow>
            <Txt style={{ flex: 1 }}>Tema</Txt>
            <View style={{ width: 220 }}>
              <Tabs<ThemePref> value={pref} onChange={setPref} options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }, { value: "system", label: "Sistema" }]} />
            </View>
          </ListRow>
        </Card>

        {/* Wide screens show this in the sidebar; phones have no sidebar, so it lives here. */}
        {wide ? null : (
          <Card style={{ gap: 8 }}>
            <Row>
              <Heart size={16} color={c.fg} />
              <Txt bold>Apoie o projeto</Txt>
            </Row>
            <Txt v="small" muted>Sem anúncios e sem paywall. Mantido por doações.</Txt>
            <Button size="sm" title="Apoiar" onPress={() => router.push("/apoie")} />
          </Card>
        )}

        <Card pad={false}>
          <CardHead title="Seus dados" />
          <ListRow onPress={exportData}>
            <Download size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>Baixar meus dados (JSON)</Txt>
          </ListRow>
          <ListRow onPress={() => router.push("/privacidade")}>
            <Txt style={{ flex: 1 }}>Política de privacidade</Txt>
          </ListRow>
          <ListRow onPress={() => router.push("/termos")}>
            <Txt style={{ flex: 1 }}>Termos de uso</Txt>
          </ListRow>
          <ListRow onPress={signOut}>
            <LogOut size={18} color={c.fg} />
            <Txt style={{ flex: 1 }}>Sair</Txt>
          </ListRow>
          <ListRow onPress={deleteAccount}>
            <Trash2 size={18} color={c.accent} />
            <Txt style={{ flex: 1 }} color={c.accent}>Apagar conta e todos os dados</Txt>
          </ListRow>
        </Card>
        <Row>
          <Txt v="tiny" muted>{me?.user.email} · rolar v0.1 · open source (AGPL-3.0)</Txt>
        </Row>
      </Screen>
    </>
  );
}
