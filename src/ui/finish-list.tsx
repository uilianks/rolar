// Finishes in a session (the ones the user got, or the taps they gave): editing in the log form, chips on the session.
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useT } from "@/lib/i18n";
import { useTechniques } from "@/lib/queries";
import type { FinishCount } from "@/shared/domain";
import { Button, Col, Input, Row, Txt } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

const MAX_COUNT = 50;

export function FinishListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: FinishCount[];
  onChange: (v: FinishCount[]) => void;
}) {
  const t = useT();
  const { c } = useTheme();
  const [draft, setDraft] = useState("");
  // Submissions from the catalog the user can see, as one-tap suggestions while typing.
  const query = draft.trim();
  const suggestions = useTechniques({ q: query, category: "submission" }, query.length >= 2).data ?? [];

  function add(name: string) {
    const v = name.trim();
    if (!v) return;
    const i = value.findIndex((f) => f.name.toLowerCase() === v.toLowerCase());
    if (i >= 0) bump(i, 1);
    else onChange([...value, { name: v, count: 1 }]);
    setDraft("");
  }

  function bump(i: number, delta: number) {
    onChange(value.map((f, j) => (j === i ? { ...f, count: Math.min(MAX_COUNT, Math.max(1, f.count + delta)) } : f)));
  }

  return (
    <Col gap={8}>
      <Txt bold>{label}</Txt>
      {value.map((f, i) => (
        <Row key={f.name.toLowerCase()} gap={8}>
          <Txt style={{ flex: 1 }}>{f.name}</Txt>
          <Pressable accessibilityLabel={t.finishes.less(f.name)} onPress={() => bump(i, -1)} disabled={f.count <= 1} style={{ padding: 6, opacity: f.count <= 1 ? 0.3 : 1 }}>
            <Minus size={16} color={c.fg} />
          </Pressable>
          <Txt bold style={{ minWidth: 24, textAlign: "center" }}>{f.count}</Txt>
          <Pressable accessibilityLabel={t.finishes.more(f.name)} onPress={() => bump(i, 1)} style={{ padding: 6 }}>
            <Plus size={16} color={c.fg} />
          </Pressable>
          <Pressable accessibilityLabel={t.finishes.remove(f.name)} onPress={() => onChange(value.filter((_, j) => j !== i))} style={{ padding: 6 }}>
            <X size={16} color={c.mutedFg} />
          </Pressable>
        </Row>
      ))}
      <Row>
        <View style={{ flex: 1 }}>
          <Input value={draft} onChangeText={setDraft} placeholder={t.finishes.placeholder} onSubmitEditing={() => add(draft)} returnKeyType="done" maxLength={60} />
        </View>
        <Button title={t.log.add} onPress={() => add(draft)} disabled={!query} />
      </Row>
      {suggestions.length ? (
        <Row wrap gap={6}>
          {suggestions.slice(0, 6).map((s) => (
            <Pressable key={s.id} onPress={() => add(s.name)} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Txt v="small">{s.name}</Txt>
            </Pressable>
          ))}
        </Row>
      ) : null}
      <Txt v="small" muted>{hint}</Txt>
    </Col>
  );
}

/** "Armlock ×2" chips; nothing when the list is empty. */
export function FinishChips({ items, tone }: { items: FinishCount[]; tone: "got" | "tapped" }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <Row wrap gap={6}>
      {items.map((f) => (
        <View
          key={f.name}
          style={{ backgroundColor: tone === "got" ? c.accent : c.muted, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}
        >
          <Txt v="small" color={tone === "got" ? "#fff" : undefined}>
            {f.count > 1 ? `${f.name} ×${f.count}` : f.name}
          </Txt>
        </View>
      ))}
    </Row>
  );
}
