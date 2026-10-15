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
  const queue = useMe().data?.admin;
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<AdminStats>("/admin/stats") });
  const st = stats.data;

  return (
    <>
      <Header title="Admin" right={<Button kind="ghost" size="sm" title="Atualizar" onPress={() => stats.refetch()} />} />
      <Screen onRefresh={() => stats.refetch()} refreshing={stats.isRefetching}>
        <Card pad={false}>
          <Section href="/admin/academias" icon={Building} title="Academias" text="Verificar cadastros, corrigir dados, transferir" count={queue?.pendingAcademies} />
          <Section href="/admin/denuncias" icon={Flag} title="Denúncias" text="Perfis, treinos e comentários denunciados" count={queue?.openReports} />
          <Section href="/admin/usuarios" icon={Users} title="Contas" text="Buscar, suspender, remover foto" />
          <Section href="/admin/flags" icon={ToggleRight} title="Feature flags" text="Ligar funções para todos ou para testadores" />
        </Card>

        {stats.isPending ? <Loading /> : null}
        <ErrorText error={stats.error} />
        {st ? (
          <>
            <Row wrap gap={space.md}>
              <Kpi icon={Users} label="Contas" value={String(st.users)} sub={`+${st.users30d} em 30 dias`} />
              <Kpi icon={UserPlus} label="Novas na semana" value={String(st.users7d)} />
              <Kpi icon={Activity} label="Ativos (7 / 30 dias)" value={`${st.active7d} / ${st.active30d}`} sub="registraram treino" />
              <Kpi icon={CalendarCheck} label="Treinos na semana" value={String(st.sessions7d)} sub={`${st.sessions30d} em 30 dias`} />
              <Kpi icon={Building} label="Academias aprovadas" value={String(st.academies)} sub={st.suspended ? `${st.suspended} conta(s) suspensa(s)` : undefined} />
            </Row>
            <Row wrap gap={space.md} style={{ alignItems: "stretch" }}>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Contas novas por semana" />
                <Col style={{ padding: space.lg }}>
                  <Bars data={st.weeks.map((w) => ({ label: shortDate(w.week), value: w.signups }))} highlightLast />
                </Col>
              </Card>
              <Card pad={false} style={{ flexGrow: 1, flexBasis: 320 }}>
                <CardHead title="Treinos registrados por semana" />
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
