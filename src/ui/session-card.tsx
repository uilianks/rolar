import { Link, router } from "expo-router";
import HandHeart from "lucide-react-native/icons/hand-heart";
import MessageCircle from "lucide-react-native/icons/message-circle";
import { Pressable, View } from "react-native";

import { duration, when } from "@/lib/format";
import { useToggleOss } from "@/lib/queries";
import type { SessionCard } from "@/lib/types";
import { KIND_LABEL } from "@/shared/domain";

import { Avatar, Belt, Card, Row, Txt } from "./kit";
import { space, useTheme } from "./theme";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt v="tiny" muted>{label}</Txt>
      <Txt style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.3 }}>{value}</Txt>
    </View>
  );
}

export function Chips({ items }: { items: string[] }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <Row wrap gap={6}>
      {items.map((t) => (
        <View key={t} style={{ backgroundColor: c.muted, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Txt v="small">{t}</Txt>
        </View>
      ))}
    </Row>
  );
}

export function OssButton({ session }: { session: Pick<SessionCard, "id" | "ossed" | "ossCount"> }) {
  const { c } = useTheme();
  const toggle = useToggleOss();
  const on = toggle.isPending ? !session.ossed : session.ossed;
  const count = session.ossCount + (toggle.isPending ? (on ? 1 : -1) : 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Oss"
      accessibilityState={{ selected: on }}
      onPress={() => toggle.mutate({ id: session.id, on: !session.ossed })}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 8 }}
    >
      <HandHeart size={16} color={on ? c.accent : c.fg} />
      <Txt v="small" bold color={on ? c.accent : c.fg}>Oss · {count}</Txt>
    </Pressable>
  );
}

export function SessionCardView({ s }: { s: SessionCard }) {
  const { c } = useTheme();
  const title = s.title || `Treino de ${KIND_LABEL[s.kind].toLowerCase()}`;
  return (
    <Card pad={false}>
      <Row gap={10} style={{ paddingHorizontal: space.lg, paddingTop: 14 }}>
        <Pressable onPress={() => router.push(`/u/${s.author.username}`)}>
          <Avatar uri={s.author.avatarUrl} name={s.author.name} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Row>
            <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>{s.author.name}</Txt>
            <Belt belt={s.author.belt} stripes={s.author.stripes} />
          </Row>
          <Txt v="small" muted numberOfLines={1}>
            {when(s.startedAt)}
            {s.academy ? ` · ${s.academy.name}` : ""}
          </Txt>
        </View>
      </Row>
      <Link href={`/treino/${s.id}`} asChild>
        <Pressable style={{ paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 14, gap: 8 }}>
          <Txt v="h3" style={{ fontSize: 16 }}>{title}</Txt>
          {s.notes ? <Txt muted numberOfLines={3}>{s.notes}</Txt> : null}
          <Row gap={20} wrap>
            <Stat label="Modalidade" value={KIND_LABEL[s.kind]} />
            <Stat label="Duração" value={duration(s.durationMin)} />
            <Stat label="Rolas" value={String(s.rounds)} />
            <Stat label="Intensidade" value={`${s.rpe}/10`} />
          </Row>
          <Chips items={s.techniques} />
        </Pressable>
      </Link>
      <Row gap={4} style={{ paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: c.border }}>
        <OssButton session={s} />
        <Link href={`/treino/${s.id}`} asChild>
          <Pressable accessibilityLabel="Comentários" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 32 }}>
            <MessageCircle size={16} color={c.fg} />
            <Txt v="small" bold>{s.commentCount}</Txt>
          </Pressable>
        </Link>
      </Row>
    </Card>
  );
}
