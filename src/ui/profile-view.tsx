// Profile page shared by "/perfil" (own) and "/u/[username]" (others).
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import BadgeCheck from "lucide-react-native/icons/badge-check";
import Ban from "lucide-react-native/icons/ban";
import Flag from "lucide-react-native/icons/flag";
import Plus from "lucide-react-native/icons/plus";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { hours } from "@/lib/format";
import { useMe, useProfile, useStats, useUserSessions } from "@/lib/queries";
import { BELT_LABEL, BELTS, type Belt as BeltName } from "@/shared/domain";

import { Avatar, Belt, Button, Card, CardHead, Col, ErrorText, Heatmap, Input, Kpi, Loading, Row, Segmented, Txt } from "./kit";
import { SessionCardView } from "./session-card";
import { BELT_COLORS, space, useTheme } from "./theme";

function years(startedAt: string | null) {
  if (!startedAt) return null;
  const [y, m] = startedAt.split("-").map(Number);
  const now = new Date();
  const total = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return total >= 12 ? `${Math.floor(total / 12)} ${Math.floor(total / 12) === 1 ? "ano" : "anos"}` : `${Math.max(total, 0)} meses`;
}

function PromotionForm({ onDone }: { onDone: () => void }) {
  const me = useMe().data;
  const qc = useQueryClient();
  const [belt, setBelt] = useState<BeltName>(me?.profile?.belt ?? "white");
  const [stripes, setStripes] = useState(me?.profile?.stripes ?? 0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<unknown>(null);
  const academyId = me?.profile?.homeAcademyId ?? null;

  async function save() {
    try {
      await api("/promotions", { method: "POST", json: { belt, stripes, promotedOn: date, academyId } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
      onDone();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Col style={{ padding: space.lg }}>
      <Segmented label="Faixa" value={belt} onChange={setBelt} options={BELTS.map((b) => ({ value: b, label: BELT_LABEL[b] }))} />
      <Segmented label="Graus" value={stripes} onChange={setStripes} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
      <Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
      <Txt v="small" muted>{academyId ? "O professor da sua academia vai receber um pedido para confirmar." : "Sem academia: a graduação fica registrada sem confirmação."}</Txt>
      <ErrorText error={error} />
      <Row>
        <Button kind="primary" title="Salvar graduação" onPress={save} />
        <Button kind="ghost" title="Cancelar" onPress={onDone} />
      </Row>
    </Col>
  );
}

export function ProfileView({ username }: { username: string }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const me = useMe().data;
  const profile = useProfile(username);
  const sessions = useUserSessions(username);
  const p = profile.data;
  const own = p?.id === me?.user.id;
  const stats = useStats("all");
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function act(path: string, method: "POST" | "DELETE") {
    try {
      await api(path, { method });
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile", username] }), qc.invalidateQueries({ queryKey: ["feed"] })]);
    } catch (e) {
      setError(e);
    }
  }

  async function block() {
    if (!p || !(await confirm(`Bloquear ${p.name}?`, "Vocês deixam de se seguir e não veem mais os treinos um do outro.", "Bloquear"))) return;
    await act(`/users/${p.id}/block`, "POST");
    router.replace("/");
  }

  async function report() {
    if (!p || !(await confirm(`Denunciar ${p.name}?`, "A equipe do projeto vai analisar o perfil.", "Denunciar"))) return;
    await api("/reports", { method: "POST", json: { targetType: "user", targetId: p.id, reason: "Denúncia pelo app" } });
  }

  if (profile.isPending) return <Loading />;
  if (!p) return <ErrorText error={profile.error} />;

  const items = sessions.data?.pages.flatMap((pg) => pg.items) ?? [];
  const started = years(p.startedAt);

  return (
    <>
      <Card pad={false}>
        <View style={{ height: 84, backgroundColor: p.belt === "white" ? c.muted : BELT_COLORS[p.belt] }} />
        <Col style={{ padding: space.lg, marginTop: -52 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <View style={{ borderWidth: 4, borderColor: c.card, borderRadius: 40 }}>
              <Avatar name={p.name} size={72} />
            </View>
            {own ? (
              <Button size="sm" title="Editar perfil" onPress={() => router.push("/config")} />
            ) : p.isFollowing ? (
              <Button size="sm" title="Seguindo" onPress={() => act(`/users/${p.id}/follow`, "DELETE")} />
            ) : p.canFollow ? (
              <Button size="sm" kind="primary" icon={UserPlus} title="Seguir" onPress={() => act(`/users/${p.id}/follow`, "POST")} />
            ) : null}
          </Row>
          <View>
            <Txt v="h1">{p.name}</Txt>
            <Txt v="small" muted>
              @{p.username}
              {p.homeAcademy ? ` · ${p.homeAcademy.name}` : ""}
            </Txt>
          </View>
          <Row gap={12} wrap>
            <Belt belt={p.belt} stripes={p.stripes} size="lg" />
            <Txt v="small">
              <Txt v="small" bold>{BELT_LABEL[p.belt]}{p.stripes ? `, ${p.stripes} ${p.stripes === 1 ? "grau" : "graus"}` : ""}</Txt>
            </Txt>
          </Row>
          <Row gap={16} wrap>
            <Txt v="small"><Txt v="small" bold>{p.followers}</Txt> <Txt v="small" muted>seguidores</Txt></Txt>
            <Txt v="small"><Txt v="small" bold>{p.following}</Txt> <Txt v="small" muted>seguindo</Txt></Txt>
            {started ? <Txt v="small"><Txt v="small" bold>{started}</Txt> <Txt v="small" muted>de jiu-jitsu</Txt></Txt> : null}
          </Row>
          <ErrorText error={error} />
          {!own ? (
            <Row>
              <Button kind="ghost" size="sm" icon={Ban} title="Bloquear" onPress={block} />
              <Button kind="ghost" size="sm" icon={Flag} title="Denunciar" onPress={report} />
            </Row>
          ) : null}
        </Col>
      </Card>

      {own && stats.data ? (
        <>
          <Row wrap gap={space.md}>
            <Kpi label="Treinos (total)" value={String(stats.data.totals.sessions)} />
            <Kpi label="Horas no tatame" value={hours(stats.data.totals.minutes)} />
            <Kpi label="Esta semana" value={String(stats.data.thisWeek.sessions)} />
          </Row>
          <Card pad={false}>
            <CardHead title="Dias no tatame" />
            <View style={{ padding: space.lg }}>
              <Heatmap days={stats.data.days} />
            </View>
          </Card>
        </>
      ) : null}

      <Card pad={false}>
        <CardHead title="Graduações" right={own && !promoting ? <Button size="sm" icon={Plus} title="Registrar" onPress={() => setPromoting(true)} /> : null} />
        {promoting ? <PromotionForm onDone={() => setPromoting(false)} /> : null}
        <View style={{ padding: space.lg, gap: 14 }}>
          {p.promotions.length === 0 ? <Txt v="small" muted>Nenhuma graduação registrada.</Txt> : null}
          {p.promotions.map((g) => (
            <Row key={g.id} gap={12} style={{ alignItems: "flex-start" }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 3, borderWidth: 2, borderStyle: g.confirmedBy ? "solid" : "dashed", borderColor: g.confirmedBy ? c.fg : c.mutedFg }} />
              <Col gap={4} style={{ flex: 1 }}>
                <Row wrap>
                  <Belt belt={g.belt} stripes={g.stripes} />
                  <Txt bold>{BELT_LABEL[g.belt]}{g.stripes ? ` · ${g.stripes}º grau` : ""}</Txt>
                </Row>
                <Row gap={4}>
                  {g.confirmedBy ? <BadgeCheck size={13} color={c.success} /> : null}
                  <Txt v="small" muted>
                    {g.promotedOn.split("-").reverse().join("/")} · {g.confirmedBy ? "confirmada pelo professor" : g.academyId ? "aguardando professor" : "registrada pelo atleta"}
                  </Txt>
                </Row>
              </Col>
            </Row>
          ))}
        </View>
      </Card>

      <Txt v="h3">Treinos</Txt>
      {items.map((s) => (
        <SessionCardView key={s.id} s={s} />
      ))}
      {items.length === 0 && !sessions.isPending ? <Txt v="small" muted>Nenhum treino visível.</Txt> : null}
      {sessions.hasNextPage ? <Button title="Carregar mais" onPress={() => sessions.fetchNextPage()} /> : null}
    </>
  );
}
