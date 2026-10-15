// UI primitives mirroring design/styles.css. Screens compose these instead of styling from scratch.
import type { LucideIcon } from "lucide-react-native";
import { Image } from "expo-image";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { API_URL } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { BELT_LABEL, type Belt as BeltName } from "@/shared/domain";

import { BELT_COLORS, BELT_MIDLINE, radius, space, useTheme } from "./theme";

type TxtVariant = "h1" | "h2" | "h3" | "body" | "small" | "tiny" | "kpi";
const TXT: Record<TxtVariant, TextStyle> = {
  h1: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, lineHeight: 29 },
  h2: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3 },
  h3: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
  tiny: { fontSize: 11, lineHeight: 15 },
  kpi: { fontSize: 24, fontWeight: "700", letterSpacing: -0.7, fontVariant: ["tabular-nums"] },
};

export function Txt({
  v = "body",
  muted,
  color,
  bold,
  style,
  ...rest
}: TextProps & {
  v?: TxtVariant;
  muted?: boolean;
  color?: string;
  bold?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[TXT[v], { color: color ?? (muted ? c.mutedFg : c.fg) }, bold && { fontWeight: "600" }, style]}
    />
  );
}

export function Row({ gap = space.sm, style, wrap, ...rest }: ViewProps & { gap?: number; wrap?: boolean }) {
  return <View {...rest} style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]} />;
}

export function Col({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Card({ children, style, pad = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
        pad && { padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHead({ title, right }: { title: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border }}>
      <Txt v="h3">{title}</Txt>
      {right}
    </Row>
  );
}

type ButtonKind = "default" | "primary" | "ghost" | "accent" | "danger";
export function Button({
  title,
  icon: Icon,
  kind = "default",
  size = "md",
  loading,
  disabled,
  block,
  style,
  ...rest
}: Omit<PressableProps, "style"> & {
  title?: string;
  icon?: LucideIcon;
  kind?: ButtonKind;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    default: { bg: c.card, fg: c.fg, border: c.border },
    primary: { bg: c.primary, fg: c.primaryFg, border: c.primary },
    ghost: { bg: "transparent", fg: c.fg, border: "transparent" },
    accent: { bg: c.accent, fg: "#fff", border: c.accent },
    danger: { bg: "transparent", fg: c.accent, border: c.border },
  };
  const p = palette[kind];
  const h = size === "sm" ? 32 : size === "lg" ? 46 : 38;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: title ? (size === "sm" ? 10 : 14) : 0,
          width: title ? undefined : h,
          borderRadius: size === "lg" ? radius.lg : radius.md,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        block && { alignSelf: "stretch" },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={p.fg} size="small" /> : Icon ? <Icon size={size === "sm" ? 16 : 18} color={p.fg} strokeWidth={1.75} /> : null}
      {title ? <Text style={{ color: p.fg, fontWeight: "500", fontSize: size === "lg" ? 15 : size === "sm" ? 13 : 14 }}>{title}</Text> : null}
    </Pressable>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "success" }) {
  const { c } = useTheme();
  const fg = tone === "accent" ? c.accent : tone === "success" ? c.success : c.fg;
  return (
    <View
      style={{
        height: 22,
        paddingHorizontal: 8,
        borderRadius: radius.full,
        backgroundColor: tone === "accent" ? c.accentSoft : c.muted,
        borderWidth: tone === "accent" ? 0 : 1,
        borderColor: c.border,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "600", color: fg }}>{children}</Text>
    </View>
  );
}

/** Photo when there is one (`uri`: the API's /api/avatars path), initials underneath while it loads or if it fails. */
export function Avatar({ name, size = 40, square, uri }: { name: string; size?: number; square?: boolean; uri?: string | null }) {
  const { c } = useTheme();
  // Remember which URL failed, so a new photo (new URL) is tried again.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const radiusValue = square ? size * 0.25 : size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radiusValue,
        backgroundColor: c.muted,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Text style={{ color: c.mutedFg, fontWeight: "600", fontSize: size * 0.33 }}>{initials(name) || "?"}</Text>
      {uri && uri !== failedUri ? (
        <Image
          source={uri.startsWith("/") ? `${API_URL}${uri}` : uri}
          accessibilityLabel={`Foto de ${name}`}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          contentFit="cover"
          transition={120}
          onError={() => setFailedUri(uri)}
        />
      ) : null}
    </View>
  );
}

/** Belt with a tip holding one white bar per stripe; the black belt has a red tip, two-tone kids belts a centre stripe. */
export function Belt({ belt, stripes = 0, size = "sm" }: { belt: BeltName; stripes?: number; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const midline = BELT_MIDLINE[belt];
  return (
    <View
      accessibilityLabel={`Faixa ${BELT_LABEL[belt].toLowerCase()}, ${stripes} graus`}
      style={{
        width: lg ? 160 : 76,
        maxWidth: "100%",
        height: lg ? 22 : 14,
        borderRadius: 3,
        backgroundColor: BELT_COLORS[belt],
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.12)",
        flexDirection: "row",
        justifyContent: "flex-end",
        flexShrink: 1,
      }}
    >
      {midline ? <View style={{ position: "absolute", left: 0, right: 0, top: "33%", height: "34%", backgroundColor: midline }} /> : null}
      <View
        style={{
          width: lg ? 46 : 26,
          marginRight: lg ? 16 : 8,
          backgroundColor: belt === "black" ? "#dc2626" : "#0a0a0a",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: lg ? 4 : 2,
        }}
      >
        {Array.from({ length: stripes }, (_, i) => (
          <View key={i} style={{ width: lg ? 3 : 2, height: "70%", backgroundColor: "#fff" }} />
        ))}
      </View>
    </View>
  );
}

export function Input({ label, hint, style, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="small" bold>{label}</Txt> : null}
      <TextInput
        placeholderTextColor={c.mutedFg}
        style={[
          {
            minHeight: 40,
            paddingHorizontal: 12,
            paddingVertical: props.multiline ? 10 : 0,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bg,
            color: c.fg,
            fontSize: 14,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          props.multiline && { minHeight: 88 },
          style,
        ]}
        {...props}
      />
      {hint ? <Txt v="small" muted>{hint}</Txt> : null}
    </View>
  );
}

/** Pill radio group. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Txt v="small" bold>{label}</Txt> : null}
      <Row wrap gap={6}>
        {options.map((o) => {
          const on = o.value === value;
          const Icon = o.icon;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={{
                height: 34,
                paddingHorizontal: 12,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: on ? c.primary : c.border,
                backgroundColor: on ? c.primary : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {Icon ? <Icon size={15} color={on ? c.primaryFg : c.fg} /> : null}
              <Text style={{ color: on ? c.primaryFg : c.fg, fontWeight: "500", fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

/** Tabs that fill the width (shadcn TabsList). */
export function Tabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <Row gap={4} style={{ padding: 4, backgroundColor: c.muted, borderRadius: radius.md }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: "center", backgroundColor: on ? c.card : "transparent" }}
          >
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "500", color: on ? c.fg : c.mutedFg }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const { c } = useTheme();
  const btn = (delta: number, text: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? "Aumentar" : "Diminuir"} ${label}`}
      onPress={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: c.muted }}
    >
      <Text style={{ fontSize: 18, color: c.fg }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Txt v="small" bold>{label}</Txt>
      <Row gap={0} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, overflow: "hidden", alignSelf: "flex-start" }}>
        {btn(-step, "−")}
        <Text style={{ minWidth: 56, textAlign: "center", fontWeight: "600", color: c.fg, fontVariant: ["tabular-nums"] }}>{value}</Text>
        {btn(step, "+")}
      </Row>
    </View>
  );
}

export function SwitchRow({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <ListRow>
      <View style={{ flex: 1 }}>
        <Txt bold>{title}</Txt>
        {hint ? <Txt v="tiny" muted>{hint}</Txt> : null}
      </View>
      <RNSwitch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.border }}
        thumbColor={value ? c.primaryFg : "#fff"}
      />
    </ListRow>
  );
}

export function ListRow({ children, onPress, highlight }: { children: ReactNode; onPress?: () => void; highlight?: boolean }) {
  const { c } = useTheme();
  const style: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderColor: c.border,
    backgroundColor: highlight ? c.muted : "transparent",
  };
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: c.muted }]}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

export function Progress({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height, backgroundColor: c.muted, borderRadius: radius.full, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", backgroundColor: color ?? c.fg, borderRadius: radius.full }} />
    </View>
  );
}

export function Kpi({ label, value, sub, icon: Icon, subTone }: { label: string; value: string; sub?: string; icon?: LucideIcon; subTone?: "up" | "down" }) {
  const { c } = useTheme();
  return (
    <Card style={{ flexGrow: 1, flexBasis: 140 }}>
      <Row gap={6}>
        {Icon ? <Icon size={14} color={c.mutedFg} /> : null}
        <Txt v="small" muted>{label}</Txt>
      </Row>
      <Txt v="kpi" style={{ marginTop: 4 }}>{value}</Txt>
      {sub ? (
        <Txt v="small" color={subTone === "up" ? c.success : subTone === "down" ? c.accent : c.mutedFg}>
          {sub}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Training calendar, GitHub-contributions style: columns are weeks (Mon→Sun), newest on the right. */
export function Heatmap({ days, weeks = 26 }: { days: Record<string, number>; weeks?: number }) {
  const { c } = useTheme();
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const cols = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (weeks - 1 - w) * 7 + d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, future: date > today, n: days[key] ?? 0 };
    }),
  );
  const scroller = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 3 }}
      // Newest weeks are on the right; start there on narrow screens.
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {cols.map((col, i) => (
        <View key={i} style={{ gap: 3 }}>
          {col.map((cell) => (
            <View
              key={cell.key}
              accessibilityLabel={`${cell.key}: ${cell.n} treinos`}
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                backgroundColor: cell.future ? "transparent" : c.heat[Math.min(4, cell.n === 0 ? 0 : cell.n + 1)],
              }}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function Bars({ data, highlightLast }: { data: { label: string; value: number }[]; highlightLast?: boolean }) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Row gap={8} style={{ height: 140, alignItems: "flex-end" }}>
      {data.map((d, i) => {
        const hi = highlightLast && i === data.length - 1;
        return (
          <View key={d.label} style={{ flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
            <View
              style={{
                width: "100%",
                maxWidth: 36,
                height: `${Math.max(3, (d.value / max) * 85)}%`,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
                backgroundColor: hi ? c.accent : c.muted,
                borderWidth: 1,
                borderColor: hi ? c.accent : c.border,
              }}
            />
            <Text style={{ fontSize: 10, color: c.mutedFg }}>{d.label}</Text>
          </View>
        );
      })}
    </Row>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 20, gap: 8 }}>
      <View style={{ width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.muted, borderWidth: 1, borderStyle: "dashed", borderColor: c.ring }}>
        <Icon size={20} color={c.fg} />
      </View>
      <Txt v="h3">{title}</Txt>
      {text ? <Txt v="small" muted style={{ textAlign: "center", maxWidth: 320 }}>{text}</Txt> : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator color={c.mutedFg} />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const { c } = useTheme();
  if (!error) return null;
  return <Txt v="small" color={c.accent}>{error instanceof Error ? error.message : String(error)}</Txt>;
}
