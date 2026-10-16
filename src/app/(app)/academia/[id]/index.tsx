import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Check from "lucide-react-native/icons/check";
import BookOpen from "lucide-react-native/icons/book-open";
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
import { useT } from "@/lib/i18n";
import { useAcademy, useAcademyMembers, useClasses, useMe, usePendingPromotions, usePendingRollCalls, useRanking } from "@/lib/queries";
import type { Academy, AcademyClass } from "@/lib/types";
import { Avatar, Badge, Belt, Button, Card, CardHead, Col, ErrorText, ListRow, Loading, Row, Tabs, Txt } from "@/ui/kit";
import { MedalTable, MissingStudents, MyFee, NoticeBoard, UpcomingEvents } from "@/ui/academy-cards";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";


export default function AcademyScreen() {
  const t = useT();
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
    if (!a || !me || !(await confirm(t.academy.leaveTitle(a.name), t.academy.leaveText, t.academy.leave))) return;
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
        title={t.nav.academy}
        left={router.canGoBack() ? <Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => router.back()} /> : undefined}
        right={<Button kind="ghost" icon={Search} accessibilityLabel={t.academy.searchAcademies} onPress={() => router.push("/academia/buscar")} />}
      />
      <Screen wide>
        <Card>
          <Row gap={16} wrap>
            <Avatar name={a.name} size={64} square />
            <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
              <Txt v="h1">{a.name}</Txt>
              <Txt v="small" muted>{[a.affiliation, a.city, a.country, approved ? `${a.memberCount} membros` : null].filter(Boolean).join(" · ")}</Txt>
              <Row>
                {!approved ? <Badge tone="accent">{t.academyStatus[a.status]}</Badge> : null}
                {a.membership ? (
                  <Badge tone={a.membership.status === "pending" ? "accent" : "default"}>
                    {a.membership.status === "pending" ? t.academy.requestSent : t.academy.role[a.membership.role]}
                  </Badge>
                ) : null}
              </Row>
            </View>
            {approved && !a.membership ? <Button kind="primary" title={t.academy.askToJoin} onPress={() => run(`/academies/${a.id}/join`, "POST")} /> : null}
            {approved ? (
              <Row gap={space.sm} wrap style={{ maxWidth: "100%" }}>
                <Button size="sm" icon={CalendarDays} title={t.academyCards.calendar} onPress={() => router.push(`/academia/${a.id}/calendario`)} />
                <Button size="sm" icon={BookOpen} title={t.techniques.title} onPress={() => router.push(`/tecnicas?academia=${a.id}`)} />
                {member && !staff ? <Button size="sm" kind="primary" icon={ScanLine} title={t.nav.checkin} onPress={startCheckinScan} /> : null}
                {staff ? <Button size="sm" icon={QrCode} title={t.academy.checkinQr} onPress={() => router.push(`/academia/${a.id}/qr`)} /> : null}
                {member && a.membership?.role === "owner" ? <Button size="sm" icon={Wallet} title={t.academy.fees} onPress={() => router.push(`/academia/${a.id}/mensalidades`)} /> : null}
              </Row>
            ) : null}
            {a.membership && a.membership.role !== "owner" ? <Button kind="danger" size="sm" title={a.membership.status === "pending" ? t.academy.cancelRequest : t.academy.leave} onPress={leave} /> : null}
          </Row>
        </Card>
        <ErrorText error={error} />

        {staff && rollCalls.data?.length ? (
          <Card pad={false}>
            <CardHead title={t.academy.pendingRollCalls} right={<Badge tone="accent">{String(rollCalls.data.length)}</Badge>} />
            {rollCalls.data.map((p) => (
              <ListRow key={`${p.class.id}/${p.date}`} onPress={() => router.push(`/academia/${a.id}/chamada?classId=${p.class.id}&date=${p.date}`)}>
                <ClipboardCheck size={18} color={c.fg} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{p.class.title}</Txt>
                  <Txt v="tiny" muted>
                    {t.weekday[p.class.weekday]} {p.date.slice(8, 10)}/{p.date.slice(5, 7)} · {p.class.startTime} · {t.academy.saidTheyCame(p.logged)}
                  </Txt>
                </View>
                <Txt v="small" bold>{t.common.confirm}</Txt>
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
            <Txt v="h3">{t.academy.underReview}</Txt>
            <Txt muted>
              {t.academy.underReviewText}
            </Txt>
            {a.registration ? <Button size="sm" title={t.academy.fixData} onPress={() => router.push(`/academia/nova?id=${a.id}`)} style={{ alignSelf: "flex-start" }} /> : null}
          </Card>
        ) : a.status === "rejected" ? (
          <Card style={{ gap: space.sm }}>
            <Txt v="h3">{t.academy.rejected}</Txt>
            {a.registration?.reviewNote ? <Txt>{a.registration.reviewNote}</Txt> : null}
            <Txt muted>{t.academy.rejectedText}</Txt>
            {a.registration ? <Button kind="primary" size="sm" title={t.academy.fixResubmit} onPress={() => router.push(`/academia/nova?id=${a.id}`)} style={{ alignSelf: "flex-start" }} /> : null}
          </Card>
        ) : !member ? (
          <Card>
            <Txt muted>{t.academy.notMemberYet}</Txt>
          </Card>
        ) : (
          <>
            <View style={{ maxWidth: 360 }}>
              <Tabs value={tab} onChange={setTab} options={[{ value: "overview", label: t.academy.overview }, { value: "members", label: t.academy.membersTab(active.length) }]} />
            </View>

            {tab === "overview" ? (
              <Row wrap gap={space.md} style={{ alignItems: "flex-start" }}>
                <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                  <CardHead title={t.academy.topMonth} right={<Trophy size={18} color={c.fg} />} />
                  {(ranking.data ?? []).slice(0, 10).map((r) => (
                    <ListRow key={r.id} highlight={r.id === me?.user.id} onPress={() => router.push(`/u/${r.username}`)}>
                      <Txt bold style={{ width: 20 }}>{r.rank}</Txt>
                      <Avatar uri={r.avatarUrl} name={r.name} size={28} />
                      <View style={{ flex: 1 }}>
                        <Txt bold>{r.id === me?.user.id ? t.academy.you : r.name}</Txt>
                        <Txt v="tiny" muted>{t.belt[r.belt]}</Txt>
                      </View>
                      <Txt bold>{r.sessions}</Txt>
                      <Txt v="tiny" muted>{t.academy.sessionsUnit}</Txt>
                    </ListRow>
                  ))}
                  {ranking.data?.length === 0 ? <View style={{ padding: space.lg }}><Txt v="small" muted>{t.academy.rankingEmpty}</Txt></View> : null}
                </Card>

                {staff ? <MissingStudents academyId={a.id} /> : null}

                {staff ? (
                  <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                    <CardHead title={t.academy.pendingRequests} right={<Badge tone="accent">{t.academy.coachesBadge}</Badge>} />
                    {pending.map((m) => (
                      <ListRow key={m.id}>
                        <Avatar uri={m.avatarUrl} name={m.name} size={28} />
                        <View style={{ flex: 1 }}>
                          <Txt bold>{m.name}</Txt>
                          <Txt v="tiny" muted>{t.academy.wantsToJoin} · {t.belt[m.belt]}</Txt>
                        </View>
                        <Button size="sm" icon={X} accessibilityLabel={t.academy.decline} onPress={() => run(`/academies/${a.id}/members/${m.id}`, "DELETE")} />
                        <Button size="sm" kind="primary" icon={Check} accessibilityLabel={t.academy.accept} onPress={() => run(`/academies/${a.id}/members/${m.id}`, "PATCH", { status: "active" })} />
                      </ListRow>
                    ))}
                    {academyPromotions.map((p) => (
                      <ListRow key={p.id}>
                        <Avatar uri={p.user.avatarUrl} name={p.user.name} size={28} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Txt bold>{p.user.name}</Txt>
                          <Row>
                            <Belt belt={p.belt} stripes={p.stripes} />
                            <Txt v="tiny" muted>{t.academy.asksPromotion}</Txt>
                          </Row>
                        </View>
                        <Button size="sm" kind="primary" icon={Check} accessibilityLabel={t.academy.confirmPromotion} onPress={() => run(`/promotions/${p.id}/confirm`, "POST")} />
                      </ListRow>
                    ))}
                    {!pending.length && !academyPromotions.length ? <View style={{ padding: space.lg }}><Txt v="small" muted>{t.academy.nothingPending}</Txt></View> : null}
                  </Card>
                ) : null}
              </Row>
            ) : (
              <Card pad={false}>
                {active.map((m) => (
                  <ListRow key={m.id} onPress={() => router.push(`/u/${m.username}`)}>
                    <Avatar uri={m.avatarUrl} name={m.name} size={28} />
                    <View style={{ flex: 1 }}>
                      <Txt bold>{m.name}</Txt>
                      <Txt v="tiny" muted>
                        {[t.academy.role[m.role], m.attendance30d !== undefined ? t.academy.attendance30d(m.attendance30d) : null].filter(Boolean).join(" · ")}
                      </Txt>
                    </View>
                    <Belt belt={m.belt} stripes={m.stripes} />
                    {a.membership?.role === "owner" && m.role === "student" ? (
                      <Button size="sm" kind="ghost" title={t.academy.makeCoach} onPress={() => run(`/academies/${a.id}/members/${m.id}`, "PATCH", { role: "coach" })} />
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
  const t = useT();
  const today = isoWeekday(new Date());
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => classes?.some((k) => k.weekday === d));
  return (
    <Card pad={false} style={{ flexGrow: 2, flexBasis: 360 }}>
      <CardHead
        title={t.academy.schedule}
        right={staff ? <Button size="sm" kind="ghost" title={classes?.length ? t.common.edit : t.academy.addClasses} onPress={() => router.push(`/academia/${academy.id}/horarios`)} /> : undefined}
      />
      {classes && !classes.length ? (
        <View style={{ padding: space.lg }}>
          <Txt v="small" muted>{staff ? t.academy.noScheduleStaff : t.academy.noSchedule}</Txt>
        </View>
      ) : null}
      {days.map((d) => (
        <View key={d}>
          <Row style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            <Txt v="small" bold>{t.weekday[d]}</Txt>
            {d === today ? <Badge tone="accent">{t.academy.today}</Badge> : null}
          </Row>
          {classes!
            .filter((k) => k.weekday === d)
            .map((k) => (
              <ListRow key={k.id}>
                <Txt v="small" style={{ width: 92, fontVariant: ["tabular-nums"] }}>{k.startTime}–{endTime(k.startTime, k.durationMin)}</Txt>
                <View style={{ flex: 1 }}>
                  <Txt bold>{k.title}</Txt>
                  <Txt v="tiny" muted>{t.sessionKind[k.kind]}</Txt>
                </View>
                {staff ? (
                  <Button
                    size="sm"
                    kind={d === today ? "primary" : "default"}
                    icon={ClipboardCheck}
                    title={t.academy.rollCall}
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
  const t = useT();
  const place = [a.address, a.city, a.country].filter(Boolean).join(", ");
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.name, place].join(" "))}`;
  return (
    <Card style={{ gap: space.sm }}>
      <Txt v="h3">{t.academy.location}</Txt>
      {a.address ? <Txt>{a.address}</Txt> : null}
      <Txt v="small" muted>{[a.city, a.country].filter(Boolean).join(", ")}</Txt>
      <Button size="sm" icon={MapPin} title={t.academy.openMap} onPress={() => Linking.openURL(map)} style={{ alignSelf: "flex-start" }} />
      {a.website || a.instagram ? (
        <Row wrap gap={space.md}>
          {a.website ? <Txt v="small" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(a.website!)}>{t.newAcademy.website}</Txt> : null}
          {a.instagram ? <Txt v="small" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`https://instagram.com/${a.instagram}`)}>@{a.instagram}</Txt> : null}
        </Row>
      ) : null}
    </Card>
  );
}
