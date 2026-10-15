import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import Activity from "lucide-react-native/icons/activity";
import Building from "lucide-react-native/icons/building";
import CalendarCheck from "lucide-react-native/icons/calendar-check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flag from "lucide-react-native/icons/flag";
import ToggleRight from "lucide-react-native/icons/toggle-right";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import type { AdminStats } from "@/lib/types";
import { Badge, Bars, Button, Card, CardHead, Col, ErrorText, Kpi, ListRow, Loading, Row, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

function Section({ href, icon: Icon, title, text, count }: { href: Href; icon: LucideIcon; title: string; text: string; count?: number }) {
  const { c } = useTheme();
  return (
    <ListRow onPress={() => router.push(href)}>
      <Icon size={18} color={c.fg} />
      <View style={{ flex: 1 }}>
        <Txt bold>{title}</Txt>
        <Txt v="tiny" muted>{text}</Txt>
      </View>
      {count ? <Badge tone="accent">{String(count)}</Badge> : null}
      <ChevronRight size={16} color={c.mutedFg} />
    </ListRow>
  );
}

const shortDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** Admin home: what waits for a decision, and how the app is doing. */
export default function AdminHome() {
  const t = useT();
  const queue = useMe().data?.admin;
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<AdminStats>("/admin/stats") });
  const st = stats.data;

  return (
    <>
      <Header title={t.nav.admin} right={<Button kind="ghost" size="sm" title={t.notifications.refresh} onPress={() => stats.refetch()} />} />
      <Screen onRefresh={() => stats.refetch()} refreshing={stats.isRefetching}>
        <Card pad={false}>
          <Section href="/admin/academias" icon={Building} title={t.admin.academies} text={t.admin.academiesText} count={queue?.pendingAcademies} />
          <Section href="/admin/denuncias" icon={Flag} title={t.admin.reportsTitle} text={t.admin.reportsText} count={queue?.openReports} />
          <Section href="/admin/usuarios" icon={Users} title={t.admin.accounts} text={t.admin.accountsText} />
          <Section href="/admin/flags" icon={ToggleRight} title={t.admin.flags} text={t.admin.flagsText} />
        </Card>

        {stats.isPending ? <Loading /> : null}
        <ErrorText error={stats.error} />
        {st ? (
          <>
            <Row wrap gap={space.md}>
              <Kpi icon={Users} label={t.admin.accounts} value={String(st.users)} sub={t.admin.in30d(`+${st.users30d}`)} />
              <Kpi icon={UserPlus} label={t.admin.newThisWeek} value={String(st.users7d)} />
              <Kpi icon={Activity} label={t.admin.active} value={`${st.active7d} / ${st.active30d}`} sub={t.admin.activeSub} />
              <Kpi icon={CalendarCheck} label={t.admin.sessionsWeek} value={String(st.sessions7d)} sub={t.admin.in30d(String(st.sessions30d))} />
              <Kpi icon={Building} label={t.admin.approvedAcademies} value={String(st.academies)} sub={st.suspended ? t.admin.suspendedAccounts(st.suspended) : undefined} />
            </Row>
            <Row wrap gap={space.md} style={{ alignItems: "stretch" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.admin.newPerWeek} />
                <Col style={{ padding: space.lg }}>
                  <Bars data={st.weeks.map((w) => ({ label: shortDate(w.week), value: w.signups }))} highlightLast />
                </Col>
              </Card>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title={t.admin.sessionsPerWeek} />
                <Col style={{ padding: space.lg }}>
                  <Bars data={st.weeks.map((w) => ({ label: shortDate(w.week), value: w.sessions }))} highlightLast />
                </Col>
              </Card>
            </Row>
          </>
        ) : null}
      </Screen>
    </>
  );
}
