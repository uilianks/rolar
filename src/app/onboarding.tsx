import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { handoff } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import type { Academy } from "@/lib/types";
import { beltOptions, profileInput, VISIBILITIES, type Belt as BeltName, type Visibility } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Avatar, Belt, Button, Card, Col, ErrorText, Input, ListRow, Row, Segmented, SwitchRow, Txt } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const STEPS = 4;

export default function Onboarding() {
  const { c } = useTheme();
  const t = useT();
  const qc = useQueryClient();
  const me = useMe().data;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(me?.user.name && me.user.name !== me.user.email ? me.user.name : "");
  const [username, setUsername] = useState((me?.user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30));
  const [birthYear, setBirthYear] = useState("");
  const [belt, setBelt] = useState<BeltName>("white");
  const [stripes, setStripes] = useState(0);
  const [startedAt, setStartedAt] = useState("");
  const [academyQuery, setAcademyQuery] = useState("");
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [registerAcademy, setRegisterAcademy] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [searchable, setSearchable] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const academies = useQuery({
    queryKey: ["academies", academyQuery],
    queryFn: () => api<Academy[]>(`/academies?q=${encodeURIComponent(academyQuery)}`),
    enabled: step === 3,
  });

  const profile = {
    username,
    name: name.trim(),
    birthYear: Number(birthYear),
    belt,
    stripes,
    startedAt: /^\d{4}-\d{2}$/.test(startedAt) ? startedAt : null,
    weeklyGoal,
    defaultVisibility: visibility,
    searchable,
    showInRanking: true,
  };

  function next() {
    setError(null);
    if (step === 1) {
      const check = profileInput.pick({ username: true, name: true, birthYear: true }).safeParse(profile);
      if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    }
    if (step < STEPS) return setStep(step + 1);
    void finish();
  }

  async function finish() {
    setBusy(true);
    try {
      await api("/me/profile", { method: "POST", json: profile });
      if (academyId) await api(`/academies/${academyId}/join`, { method: "POST" });
      if (registerAcademy) handoff.set("/academia/nova");
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 48, gap: space.xl, width: "100%", maxWidth: 460, alignSelf: "center", flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Col gap={8}>
          <Row gap={6}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i < step ? c.fg : c.border }} />
            ))}
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="tiny" muted>{t.onboarding.step(step, STEPS)}</Txt>
            <Pressable onPress={() => authClient.signOut().then(() => qc.clear())}>
              <Txt v="tiny" muted>{t.onboarding.signOut}</Txt>
            </Pressable>
          </Row>
        </Col>

        {step === 1 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">{t.onboarding.nameTitle}</Txt>
              <Txt muted>{t.onboarding.nameText}</Txt>
            </Col>
            <Input label={t.onboarding.name} value={name} onChangeText={setName} autoComplete="name" />
            <Input
              label={t.onboarding.username}
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              autoCapitalize="none"
              hint={`@${username || t.onboarding.usernamePlaceholder}`}
            />
            <Input
              label={t.onboarding.birthYear}
              value={birthYear}
              onChangeText={(v) => setBirthYear(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="1995"
              hint={t.onboarding.birthYearHint}
            />
          </Col>
        )}

        {step === 2 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">{t.onboarding.beltTitle}</Txt>
              <Txt muted>{t.onboarding.beltText}</Txt>
            </Col>
            <Row wrap gap={8}>
              {beltOptions(Number(birthYear), belt).map((b) => (
                <Pressable
                  key={b}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: belt === b }}
                  onPress={() => setBelt(b)}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    padding: 12,
                    gap: 10,
                    borderRadius: radius.lg,
                    borderWidth: belt === b ? 2 : 1,
                    borderColor: belt === b ? c.fg : c.border,
                  }}
                >
                  <Belt belt={b} />
                  <Txt bold>{t.belt[b]}</Txt>
                </Pressable>
              ))}
            </Row>
            <Segmented label={t.profile.stripes} value={stripes} onChange={setStripes} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
            <Input label={t.onboarding.startedAt} value={startedAt} onChangeText={setStartedAt} placeholder="2020-02" />
          </Col>
        )}

        {step === 3 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">{t.onboarding.academyTitle}</Txt>
              <Txt muted>{t.onboarding.academyText}</Txt>
            </Col>
            <Input value={academyQuery} onChangeText={setAcademyQuery} placeholder={t.onboarding.academySearch} />
            <Card pad={false}>
              {(academies.data ?? []).map((a) => (
                <ListRow key={a.id} onPress={() => { setAcademyId(a.id); setRegisterAcademy(false); }} highlight={academyId === a.id}>
                  <Avatar name={a.name} size={32} square />
                  <View style={{ flex: 1 }}>
                    <Txt bold>{a.name}</Txt>
                    <Txt v="tiny" muted>{[a.city, t.findAcademy.members(a.memberCount)].filter(Boolean).join(" · ")}</Txt>
                  </View>
                </ListRow>
              ))}
              {academies.data?.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>{t.findAcademy.none}</Txt></View> : null}
            </Card>
            <Card pad={false}>
              <ListRow onPress={() => { setRegisterAcademy(!registerAcademy); setAcademyId(null); }} highlight={registerAcademy}>
                <View style={{ flex: 1 }}>
                  <Txt bold>{t.onboarding.registerTitle}</Txt>
                  <Txt v="tiny" muted>{t.onboarding.registerText}</Txt>
                </View>
              </ListRow>
            </Card>
          </Col>
        )}

        {step === 4 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">{t.onboarding.lastTitle}</Txt>
              <Txt muted>{t.onboarding.lastText}</Txt>
            </Col>
            <Segmented
              label={t.onboarding.defaultVisibility}
              value={visibility}
              onChange={setVisibility}
              options={VISIBILITIES.map((v) => ({ value: v, label: t.visibility[v] }))}
            />
            <Card pad={false}>
              <SwitchRow title={t.onboarding.searchable} hint={t.onboarding.searchableHint} value={searchable} onChange={setSearchable} />
            </Card>
            <Segmented
              label={t.onboarding.weeklyGoal}
              value={weeklyGoal}
              onChange={setWeeklyGoal}
              options={[2, 3, 4, 5, 0].map((n) => ({ value: n, label: n ? String(n) : t.onboarding.noGoal }))}
            />
          </Col>
        )}

        <ErrorText error={error} />
        <View style={{ flex: 1 }} />
        <Row>
          {step > 1 ? <Button size="lg" title={t.common.back} onPress={() => setStep(step - 1)} /> : null}
          <Button kind="primary" size="lg" title={step === STEPS ? t.onboarding.start : t.onboarding.next} loading={busy} onPress={next} style={{ flex: 1 }} />
        </Row>
      </ScrollView>
    </View>
  );
}
