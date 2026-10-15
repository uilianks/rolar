// App frame from the wireframes: sidebar on wide screens (≥ 900 px), floating dock on phones.
import { router, usePathname } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import ChartNoAxesColumn from "lucide-react-native/icons/chart-no-axes-column";
import Heart from "lucide-react-native/icons/heart";
import House from "lucide-react-native/icons/house";
import Plus from "lucide-react-native/icons/plus";
import ScanLine from "lucide-react-native/icons/scan-line";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Settings from "lucide-react-native/icons/settings";
import SunMoon from "lucide-react-native/icons/sun-moon";
import Timer from "lucide-react-native/icons/timer";
import User from "lucide-react-native/icons/user";
import Users from "lucide-react-native/icons/users";
import { type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { startCheckinScan } from "@/lib/checkin";
import { useMe } from "@/lib/queries";

import { Button, Card, Row, Txt } from "./kit";
import { radius, space, useTheme } from "./theme";

export const WIDE = 900;

type NavItem = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean; onPress?: () => void };

const MAIN: NavItem[] = [
  { href: "/", label: "Feed", icon: House, match: (p) => p === "/" },
  { href: "/progresso", label: "Progresso", icon: ChartNoAxesColumn, match: (p) => p.startsWith("/progresso") },
  { href: "/academia", label: "Academia", icon: Users, match: (p) => p.startsWith("/academia") },
  { href: "/perfil", label: "Perfil", icon: User, match: (p) => p.startsWith("/perfil") },
];
/** Check-in is an action (opens the scanner), not a page: the dock's centre button on phones. */
const CHECKIN: NavItem = { href: "/ler-qr", label: "Check-in", icon: ScanLine, match: (p) => p.startsWith("/ler-qr") || p.startsWith("/checkin"), onPress: startCheckinScan };

const TOOLS: NavItem[] = [
  { href: "/timer", label: "Timer de rounds", icon: Timer, match: (p) => p.startsWith("/timer") },
  { href: "/notificacoes", label: "Notificações", icon: Bell, match: (p) => p.startsWith("/notificacoes") },
  { href: "/config", label: "Configurações", icon: Settings, match: (p) => p.startsWith("/config") },
  { href: "/apoie", label: "Apoie o projeto", icon: Heart, match: (p) => p.startsWith("/apoie") },
];

const ADMIN: NavItem = { href: "/admin", label: "Admin", icon: ShieldCheck, match: (p) => p.startsWith("/admin") };

export function useWide() {
  return useWindowDimensions().width >= WIDE;
}

/** The app icon in small: "r" over a red bar (the black belt's red tip). */
export function BrandMark({ size = 26 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: c.primaryFg, fontWeight: "800", fontSize: size * 0.56, lineHeight: size * 0.6, marginTop: -size * 0.06 }}>r</Text>
      <View style={{ width: size * 0.34, height: Math.max(2, size * 0.08), borderRadius: size * 0.03, backgroundColor: c.accent, marginTop: size * 0.02 }} />
    </View>
  );
}

function SideLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { c } = useTheme();
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={item.onPress ?? (() => router.navigate(item.href as never))}
      style={(state) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: active || (state as { hovered?: boolean }).hovered ? c.muted : "transparent",
      })}
    >
      <Icon size={18} color={active ? c.fg : c.mutedFg} strokeWidth={1.75} />
      <Text style={{ color: active ? c.fg : c.mutedFg, fontWeight: "500", fontSize: 14, flex: 1 }}>{item.label}</Text>
      {badge ? (
        <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.full, paddingHorizontal: 7, height: 20, justifyContent: "center" }}>
          <Text style={{ color: c.accent, fontSize: 11, fontWeight: "600" }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Sidebar({ path }: { path: string }) {
  const { c, scheme, setPref } = useTheme();
  const me = useMe().data;
  const unread = me?.unreadNotifications;
  return (
    <View style={{ width: 248, borderRightWidth: 1, borderColor: c.border, padding: space.md, paddingTop: space.lg, gap: 4 }}>
      <Row style={{ paddingHorizontal: 8, paddingBottom: 16 }}>
        <BrandMark />
        <Txt v="h2" style={{ fontWeight: "800", letterSpacing: -0.6 }}>rolar</Txt>
      </Row>
      <Button kind="primary" icon={Plus} title="Registrar treino" onPress={() => router.navigate("/registrar")} style={{ marginBottom: 12 }} />
      {MAIN.map((i) => (
        <SideLink key={i.href} item={i} active={i.match(path)} />
      ))}
      <Txt v="tiny" muted style={{ paddingHorizontal: 10, paddingTop: 14, paddingBottom: 4 }}>Ferramentas</Txt>
      <SideLink item={CHECKIN} active={CHECKIN.match(path)} />
      {TOOLS.map((i) => (
        <SideLink key={i.href} item={i} active={i.match(path)} badge={i.href === "/notificacoes" ? unread : undefined} />
      ))}
      {me?.admin ? <SideLink item={ADMIN} active={ADMIN.match(path)} badge={me.admin.pendingAcademies} /> : null}
      <View style={{ flex: 1 }} />
      <Card style={{ gap: 8 }}>
        <Row>
          <Heart size={16} color={c.fg} />
          <Txt bold>Projeto open source</Txt>
        </Row>
        <Txt v="small" muted>Sem anúncios e sem paywall. Mantido por doações.</Txt>
        <Button size="sm" title="Apoiar" onPress={() => router.navigate("/apoie")} />
      </Card>
      <SideLink
        item={{ href: "", label: "Tema claro/escuro", icon: SunMoon, match: () => false, onPress: () => setPref(scheme === "dark" ? "light" : "dark") }}
        active={false}
      />
    </View>
  );
}

function Dock({ path }: { path: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const items = [MAIN[0], MAIN[1], null, MAIN[2], MAIN[3]];
  return (
    <View
      style={{
        position: "absolute",
        bottom: Math.max(12, insets.bottom),
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        padding: 6,
        borderRadius: radius.xl,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {items.map((item) =>
        item ? (
          <Pressable
            key={item.href}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.match(path) }}
            onPress={() => router.navigate(item.href as never)}
            style={{ width: 62, paddingVertical: 6, borderRadius: 12, alignItems: "center", gap: 2, backgroundColor: item.match(path) ? c.muted : "transparent" }}
          >
            <item.icon size={20} color={item.match(path) ? c.fg : c.mutedFg} strokeWidth={1.75} />
            <Text style={{ fontSize: 10, fontWeight: "500", color: item.match(path) ? c.fg : c.mutedFg }}>{item.label}</Text>
          </Pressable>
        ) : (
          <Pressable
            key="cta"
            accessibilityRole="button"
            accessibilityLabel="Check-in"
            onPress={startCheckinScan}
            style={{ width: 56, height: 46, marginHorizontal: 4, borderRadius: 14, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}
          >
            <ScanLine size={24} color={c.primaryFg} strokeWidth={2} />
          </Pressable>
        ),
      )}
    </View>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const wide = useWide();
  const path = usePathname();
  const hideDock = path.startsWith("/registrar") || path.startsWith("/timer");
  return (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column", backgroundColor: c.bg }}>
      {wide ? <Sidebar path={path} /> : null}
      <View style={{ flex: 1 }}>{children}</View>
      {!wide && !hideDock ? <Dock path={path} /> : null}
    </View>
  );
}

/** Sticky top bar of a screen. */
export function Header({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg, borderBottomWidth: 1, borderColor: c.border }}>
      <Row style={{ height: 56, paddingHorizontal: space.lg }}>
        {left}
        <Txt v="h3" style={{ flex: 1, fontSize: 16 }} numberOfLines={1}>{title}</Txt>
        {right}
      </Row>
    </View>
  );
}

/** Scrollable page body with the max widths of the wireframes. */
export function Screen({
  children,
  wide,
  onRefresh,
  refreshing = false,
  onEndReached,
}: {
  children: ReactNode;
  wide?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onEndReached?: () => void;
}) {
  const isWide = useWide();
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh && Platform.OS !== "web" ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      onScroll={
        onEndReached
          ? ({ nativeEvent: e }) => {
              if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 400) onEndReached();
            }
          : undefined
      }
      scrollEventThrottle={200}
      contentContainerStyle={{
        padding: isWide ? space.xl : space.lg,
        paddingBottom: isWide ? 48 : 112,
        gap: space.lg,
        width: "100%",
        maxWidth: wide ? 1080 : 720,
        alignSelf: "center",
      }}
    >
      {children}
    </ScrollView>
  );
}
