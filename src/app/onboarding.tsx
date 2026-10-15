import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { handoff } from "@/lib/handoff";
import { useMe } from "@/lib/queries";
import type { Academy } from "@/lib/types";
import { BELT_LABEL, beltOptions, MIN_AGE, profileInput, VISIBILITY_LABEL, VISIBILITIES, type Belt as BeltName, type Visibility } from "@/shared/domain";
import { Avatar, Belt, Button, Card, Col, ErrorText, Input, ListRow, Row, Segmented, SwitchRow, Txt } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const STEPS = 4;

export default function Onboarding() {
  const { c } = useTheme();
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
      if (!check.success) return setError(check.error.issues[0].message);
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
            <Txt v="tiny" muted>Passo {step} de {STEPS}</Txt>
            <Pressable onPress={() => authClient.signOut().then(() => qc.clear())}>
              <Txt v="tiny" muted>Sair</Txt>
            </Pressable>
          </Row>
        </Col>

        {step === 1 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">Oss! Como te chamam no tatame?</Txt>
              <Txt muted>Isso aparece no seu perfil.</Txt>
            </Col>
            <Input label="Nome" value={name} onChangeText={setName} autoComplete="name" />
            <Input
              label="Nome de usuário"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase())}
              autoCapitalize="none"
              hint={`@${username || "voce"}`}
            />
            <Input
              label="Ano de nascimento"
              value={birthYear}
              onChangeText={(t) => setBirthYear(t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="1995"
              hint={`Não aparece para ninguém. É preciso ter ${MIN_AGE} anos ou mais. Menores de 18 ficam com treinos visíveis só para seguidores e fora da busca.`}
            />
          </Col>
        )}

        {step === 2 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">Qual é a sua faixa?</Txt>
              <Txt muted>Você pode registrar o histórico de graduações depois.</Txt>
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
                  <Txt bold>{BELT_LABEL[b]}</Txt>
                </Pressable>
              ))}
            </Row>
            <Segmented label="Graus" value={stripes} onChange={setStripes} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
            <Input label="Treina desde (AAAA-MM)" value={startedAt} onChangeText={setStartedAt} placeholder="2020-02" />
          </Col>
        )}

        {step === 3 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">Onde você treina?</Txt>
              <Txt muted>O professor aprova a sua entrada. Dá para pular e fazer depois.</Txt>
            </Col>
            <Input value={academyQuery} onChangeText={setAcademyQuery} placeholder="Buscar academia ou cidade" />
            <Card pad={false}>
              {(academies.data ?? []).map((a) => (
                <ListRow key={a.id} onPress={() => { setAcademyId(a.id); setRegisterAcademy(false); }} highlight={academyId === a.id}>
                  <Avatar name={a.name} size={32} square />
                  <View style={{ flex: 1 }}>
                    <Txt bold>{a.name}</Txt>
                    <Txt v="tiny" muted>{[a.city, `${a.memberCount} membros`].filter(Boolean).join(" · ")}</Txt>
                  </View>
                </ListRow>
              ))}
              {academies.data?.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>Nenhuma academia encontrada.</Txt></View> : null}
            </Card>
            <Card pad={false}>
              <ListRow onPress={() => { setRegisterAcademy(!registerAcademy); setAcademyId(null); }} highlight={registerAcademy}>
                <View style={{ flex: 1 }}>
                  <Txt bold>Sou responsável e a minha academia não está aqui</Txt>
                  <Txt v="tiny" muted>Ao terminar, você preenche o cadastro da academia. Ela passa por verificação antes de aparecer.</Txt>
                </View>
              </ListRow>
            </Card>
          </Col>
        )}

        {step === 4 && (
          <Col gap={space.lg}>
            <Col gap={4}>
              <Txt v="h1">Últimos ajustes</Txt>
              <Txt muted>Dá para mudar tudo depois nas configurações.</Txt>
            </Col>
            <Segmented
              label="Quem vê seus treinos por padrão"
              value={visibility}
              onChange={setVisibility}
              options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
            />
            <Card pad={false}>
              <SwitchRow title="Aparecer na busca" hint="Outras pessoas podem te encontrar" value={searchable} onChange={setSearchable} />
            </Card>
            <Segmented
              label="Meta de treinos por semana"
              value={weeklyGoal}
              onChange={setWeeklyGoal}
              options={[2, 3, 4, 5, 0].map((n) => ({ value: n, label: n ? String(n) : "Sem meta" }))}
            />
          </Col>
        )}

        <ErrorText error={error} />
        <View style={{ flex: 1 }} />
        <Row>
          {step > 1 ? <Button size="lg" title="Voltar" onPress={() => setStep(step - 1)} /> : null}
          <Button kind="primary" size="lg" title={step === STEPS ? "Começar a treinar" : "Continuar"} loading={busy} onPress={next} style={{ flex: 1 }} />
        </Row>
      </ScrollView>
    </View>
  );
}
