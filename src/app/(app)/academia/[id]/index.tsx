import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ClipboardCheck from "lucide-react-native/icons/clipboard-check";
import QrCode from "lucide-react-native/icons/qr-code";
import ScanLine from "lucide-react-native/icons/scan-line";
import Wallet from "lucide-react-native/icons/wallet";
import MapPin from "lucide-react-native/icons/map-pin";
import Search from "lucide-react-native/icons/search";
import Trophy from "lucide-react-native/icons/trophy";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/lib/api";
import { startCheckinScan } from "@/lib/checkin";
import { confirm } from "@/lib/confirm";
import { endTime, isoWeekday } from "@/lib/format";
import { useAcademy, useAcademyMembers, useClasses, useMe, usePendingPromotions, usePendingRollCalls, useRanking } from "@/lib/queries";
import type { Academy, AcademyClass } from "@/lib/types";
import { ACADEMY_STATUS_LABEL, BELT_LABEL, KIND_LABEL, WEEKDAY_LABEL } from "@/shared/domain";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, ListRow, Loading, Row, Tabs, Txt } from "@/ui/kit";
import { MedalTable, MissingStudents, MyFee, NoticeBoard, UpcomingEvents } from "@/ui/academy-cards";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

const ROLE_LABEL = { owner: "Responsável", coach: "Professor", student: "Aluno" } as const;

export default function AcademyScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const me = useMe().data;
  const academy = useAcademy(id);
  const a = academy.data;
  const approved = a?.status === "approved";
  const member = approved && a?.membership?.status === "active";
  const staff = member && (a?.membership?.role === "owner" || a?.membership?.role === "coach");
  const members = useAcademyMembers(a?.id, member);
  const ranking = useRanking(a?.id, member);
  const promotions = usePendingPromotions();
  const classes = useClasses(approved ? a?.id : null);
  const rollCalls = usePendingRollCalls(a?.id, !!staff);
  const [tab, setTab] = useState<"overview" | "members">("overview");
  const [error, setError] = useState<unknown>(null);

  async function run(path: string, method: "POST" | "PATCH" | "DELETE", json?: unknown) {
    setError(null);
    try {
      await api(path, { method, json });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["academy", id] }),
        qc.invalidateQueries({ queryKey: ["academy", a?.id] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
        qc.invalidateQueries({ queryKey: ["promotions"] }),
      ]);
    } catch (e) {
      setError(e);
    }
  }

  async function leave() {
    if (!a || !me || !(await confirm(`Sair de ${a.name}?`, "Você deixa de aparecer na lista e no ranking.", "Sair"))) return;
    await run(`/academies/${a.id}/members/${me.user.id}`, "DELETE");
    router.replace("/academia");
  }

  if (academy.isPending) return <Loading />;
  if (!a) return <ErrorText error={academy.error} />;

  const pending = (members.data ?? []).filter((m) => m.status === "pending");
  const active = (members.data ?? []).filter((m) => m.status === "active");
  const academyPromotions = (promotions.data ?? []).filter((p) => p.academyId === a.id);

  return (
    <>
      <Header
        title="Academia"
        left={router.canGoBack() ? <Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => router.back()} /> : undefined}
        right={<Button kind="ghost" icon={Search} accessibilityLabel="Buscar academias" onPress={() => router.push("/academia/buscar")} />}
      />
      <Screen wide>
        <Card>
          <Row gap={16} wrap>
            <Avatar name={a.name} size={64} square />
            <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
              <Txt v="h1">{a.name}</Txt>
              <Txt v="small" muted>{[a.affiliation, a.city, a.country, approved ? `${a.memberCount} membros` : null].filter(Boolean).join(" · ")}</Txt>
              <Row>
                {!approved ? <Badge tone="accent">{ACADEMY_STATUS_LABEL[a.status]}</Badge> : null}
                {a.membership ? (
                  <Badge tone={a.membership.status === "pending" ? "accent" : "default"}>
                    {a.membership.status === "pending" ? "Pedido enviado" : ROLE_LABEL[a.membership.role]}
                  </Badge>
                ) : null}
              </Row>
            </View>
            {approved && !a.membership ? <Button kind="primary" title="Pedir para entrar" onPress={() => run(`/academies/${a.id}/join`, "POST")} /> : null}
            {approved ? (
              <Row gap={space.sm} wrap style={{ maxWidth: "100%" }}>
                <Button size="sm" icon={CalendarDays} title="Calendário" onPress={() => router.push(`/academia/${a.id}/calendario`)} />
                {member && !staff ? <Button size="sm" kind="primary" icon={ScanLine} title="Check-in" onPress={startCheckinScan} /> : null}
                {staff ? <Button size="sm" icon={QrCode} title="QR de check-in" onPress={() => router.push(`/academia/${a.id}/qr`)} /> : null}
                {member && a.membership?.role === "owner" ? <Button size="sm" icon={Wallet} title="Mensalidades" onPress={() => router.push(`/academia/${a.id}/mensalidades`)} /> : null}
              </Row>
            ) : null}
            {a.membership && a.membership.role !== "owner" ? <Button kind="danger" size="sm" title={a.membership.status === "pending" ? "Cancelar pedido" : "Sair"} onPress={leave} /> : null}
          </Row>
        </Card>
        <ErrorText error={error} />

        {staff && rollCalls.data?.length ? (
          <Card pad={false}>
            <CardHead title="Chamadas por fazer" right={<Badge tone="accent">{String(rollCalls.data.length)}</Badge>} />
            {rollCalls.data.map((p) => (
              <ListRow key={`${p.class.id}/${p.date}`} onPress={() => router.push(`/academia/${a.id}/chamada?classId=${p.class.id}&date=${p.date}`)}>
                <ClipboardCheck size={18} color={c.fg} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{p.class.title}</Txt>
                  <Txt v="tiny" muted>
                    {WEEKDAY_LABEL[p.class.weekday]} {p.date.slice(8, 10)}/{p.date.slice(5, 7)} · {p.class.startTime} · {p.logged === 1 ? "1 aluno disse que veio" : `${p.logged} alunos disseram que vieram`}
                  </Txt>
                </View>
                <Txt v="small" bold>Confirmar</Txt>
              </ListRow>
            ))}
          </Card>
        ) : null}

        {member ? <MyFee academyId={a.id} /> : null}
        {member ? <NoticeBoard academyId={a.id} staff={!!staff} /> : null}

        {approved ? (
          <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
            <Schedule academy={a} classes={classes.data} staff={!!staff} />
            <Col gap={space.md} style={{ flexGrow: 1, flexBasis: 260 }}>
              <Location academy={a} />
            </Col>
          </Row>
        ) : null}
        {approved ? (
          <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
            <UpcomingEvents academyId={a.id} staff={!!staff} />
            <MedalTable academyId={a.id} />
          </Row>
        ) : null}

        {a.status === "pending" ? (
          <Card style={{ gap: space.sm }}>
            <Txt v="h3">Cadastro em análise</Txt>
            <Txt muted>
              A nossa equipe está a verificar os dados da academia. Enquanto isso, ela não aparece na busca e não aceita
              alunos. Você recebe uma notificação com a decisão.
            </Txt>
            {a.registration ? <Button size="sm" title="Corrigir dados" onPress={() => router.push(`/academia/nova?id=${a.id}`)} style={{ alignSelf: "flex-start" }} /> : null}
          </Card>
        ) : a.status === "rejected" ? (
          <Card style={{ gap: space.sm }}>
            <Txt v="h3">Cadastro recusado</Txt>
            {a.registration?.reviewNote ? <Txt>{a.registration.reviewNote}</Txt> : null}
            <Txt muted>Corrija os dados e reenvie; a academia volta para a fila de verificação.</Txt>
            {a.registration ? <Button kind="primary" size="sm" title="Corrigir e reenviar" onPress={() => router.push(`/academia/nova?id=${a.id}`)} style={{ alignSelf: "flex-start" }} /> : null}
          </Card>
        ) : !member ? (
          <Card>
            <Txt muted>Membros, ranking e pedidos aparecem quando o professor aprovar a sua entrada.</Txt>
          </Card>
        ) : (
          <>
            <View style={{ maxWidth: 360 }}>
              <Tabs value={tab} onChange={setTab} options={[{ value: "overview", label: "Visão geral" }, { value: "members", label: `Membros (${active.length})` }]} />
            </View>

            {tab === "overview" ? (
              <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
                <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                  <CardHead title="Mais presentes no mês" right={<Trophy size={18} color={c.fg} />} />
                  {(ranking.data ?? []).slice(0, 10).map((r) => (
                    <ListRow key={r.id} highlight={r.id === me?.user.id} onPress={() => router.push(`/u/${r.username}`)}>
                      <Txt bold style={{ width: 20 }}>{r.rank}</Txt>
                      <Avatar name={r.name} size={28} />
                      <View style={{ flex: 1 }}>
                        <Txt bold>{r.id === me?.user.id ? "Você" : r.name}</Txt>
                        <Txt v="tiny" muted>{BELT_LABEL[r.belt]}</Txt>
                      </View>
                      <Txt bold>{r.sessions}</Txt>
                      <Txt v="tiny" muted>treinos</Txt>
                    </ListRow>
                  ))}
                  {ranking.data?.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>Ninguém registrou treino aqui este mês. Seja o primeiro!</Txt></View> : null}
                </Card>

                {staff ? <MissingStudents academyId={a.id} /> : null}

                {staff ? (
                  <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                    <CardHead title="Pedidos pendentes" right={<Badge tone="accent">professores</Badge>} />
                    {pending.map((m) => (
                      <ListRow key={m.id}>
                        <Avatar name={m.name} size={28} />
                        <View style={{ flex: 1 }}>
                          <Txt bold>{m.name}</Txt>
                          <Txt v="tiny" muted>quer entrar na academia · {BELT_LABEL[m.belt]}</Txt>
                        </View>
                        <Button size="sm" icon={X} accessibilityLabel="Recusar" onPress={() => run(`/academies/${a.id}/members/${m.id}`, "DELETE")} />
                        <Button size="sm" kind="primary" icon={Check} accessibilityLabel="Aceitar" onPress={() => run(`/academies/${a.id}/members/${m.id}`, "PATCH", { status: "active" })} />
                      </ListRow>
                    ))}
                    {academyPromotions.map((p) => (
                      <ListRow key={p.id}>
                        <Avatar name={p.user.name} size={28} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Txt bold>{p.user.name}</Txt>
                          <Row>
                            <Belt belt={p.belt} stripes={p.stripes} />
                            <Txt v="tiny" muted>pede confirmação de graduação</Txt>
                          </Row>
                        </View>
                        <Button size="sm" kind="primary" icon={Check} accessibilityLabel="Confirmar graduação" onPress={() => run(`/promotions/${p.id}/confirm`, "POST")} />
                      </ListRow>
                    ))}
                    {!pending.length && !academyPromotions.length ? <View style={{ padding: space.lg }}><Txt v="small" muted>Nada pendente.</Txt></View> : null}
                  </Card>
                ) : null}
              </Row>
            ) : (
              <Card pad={false}>
                {active.map((m) => (
                  <ListRow key={m.id} onPress={() => router.push(`/u/${m.username}`)}>
                    <Avatar name={m.name} size={28} />
                    <View style={{ flex: 1 }}>
                      <Txt bold>{m.name}</Txt>
                      <Txt v="tiny" muted>
                        {[ROLE_LABEL[m.role], m.attendance30d !== undefined ? `${m.attendance30d} presença${m.attendance30d === 1 ? "" : "s"} em 30 dias` : null].filter(Boolean).join(" · ")}
                      </Txt>
                    </View>
                    <Belt belt={m.belt} stripes={m.stripes} />
                    {a.membership?.role === "owner" && m.role === "student" ? (
                      <Button size="sm" kind="ghost" title="Tornar professor" onPress={() => run(`/academies/${a.id}/members/${m.id}`, "PATCH", { role: "coach" })} />
                    ) : null}
                  </ListRow>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

/** Weekly timetable, today's classes first in line for staff to take the roll. */
function Schedule({ academy, classes, staff }: { academy: Academy; classes?: AcademyClass[]; staff: boolean }) {
  const today = isoWeekday(new Date());
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => classes?.some((k) => k.weekday === d));
  return (
    <Card pad={false} style={{ flexGrow: 2, flexBasis: 360 }}>
      <CardHead
        title="Horários"
        right={staff ? <Button size="sm" kind="ghost" title={classes?.length ? "Editar" : "Adicionar aulas"} onPress={() => router.push(`/academia/${academy.id}/horarios`)} /> : undefined}
      />
      {classes && !classes.length ? (
        <View style={{ padding: space.lg }}>
          <Txt v="small" muted>{staff ? "Cadastre as aulas da semana para os alunos verem e para fazer a chamada." : "A academia ainda não publicou os horários."}</Txt>
        </View>
      ) : null}
      {days.map((d) => (
        <View key={d}>
          <Row style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            <Txt v="small" bold>{WEEKDAY_LABEL[d]}</Txt>
            {d === today ? <Badge tone="accent">Hoje</Badge> : null}
          </Row>
          {classes!
            .filter((k) => k.weekday === d)
            .map((k) => (
              <ListRow key={k.id}>
                <Txt v="small" style={{ width: 92, fontVariant: ["tabular-nums"] }}>{k.startTime}–{endTime(k.startTime, k.durationMin)}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt bold>{k.title}</Txt>
                  <Txt v="tiny" muted>{KIND_LABEL[k.kind]}</Txt>
                </View>
                {staff ? (
                  <Button
                    size="sm"
                    kind={d === today ? "primary" : "default"}
                    icon={ClipboardCheck}
                    title="Chamada"
                    onPress={() => router.push(`/academia/${academy.id}/chamada?classId=${k.id}&weekday=${k.weekday}`)}
                  />
                ) : null}
              </ListRow>
            ))}
        </View>
      ))}
    </Card>
  );
}

function Location({ academy: a }: { academy: Academy }) {
  const place = [a.address, a.city, a.country].filter(Boolean).join(", ");
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.name, place].join(" "))}`;
  return (
    <Card style={{ gap: space.sm }}>
      <Txt v="h3">Local</Txt>
      {a.address ? <Txt>{a.address}</Txt> : null}
      <Txt v="small" muted>{[a.city, a.country].filter(Boolean).join(", ")}</Txt>
      <Button size="sm" icon={MapPin} title="Abrir no mapa" onPress={() => Linking.openURL(map)} style={{ alignSelf: "flex-start" }} />
      {a.website || a.instagram ? (
        <Row wrap gap={space.md}>
          {a.website ? <Txt v="small" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(a.website!)}>Site</Txt> : null}
          {a.instagram ? <Txt v="small" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`https://instagram.com/${a.instagram}`)}>@{a.instagram}</Txt> : null}
        </Row>
      ) : null}
    </Card>
  );
}
