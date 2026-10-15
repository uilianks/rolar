import { useState } from "react";
import { View } from "react-native";

import { useT } from "@/lib/i18n";
import { WEEKLY_GOAL_MAX } from "@/shared/domain";

import { Input, Segmented } from "./kit";

const PRESETS = [1, 2, 3, 4, 5, 6];
const CUSTOM = "custom";

/** Weekly session goal: quick picks, or "Other" to type any number from 1 to WEEKLY_GOAL_MAX. */
export function GoalPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  // A stored goal outside the quick picks (say 7) opens straight in the typed field.
  const [custom, setCustom] = useState(value !== 0 && !PRESETS.includes(value));
  const [text, setText] = useState(custom ? String(value) : "");

  function pick(v: number | typeof CUSTOM) {
    if (v !== CUSTOM) {
      setCustom(false);
      return onChange(v);
    }
    setCustom(true);
    setText(value ? String(value) : "");
  }

  function type(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const n = Math.min(Number(digits), WEEKLY_GOAL_MAX);
    // Above the maximum it shows the maximum; a lone 0 clears the field (0 is the "no goal" pick).
    setText(n ? String(n) : "");
    if (n) onChange(n);
  }

  return (
    <View style={{ gap: 8 }}>
      <Segmented<number | typeof CUSTOM>
        label={t.onboarding.weeklyGoal}
        value={custom ? CUSTOM : value}
        onChange={pick}
        options={[
          ...PRESETS.map((n) => ({ value: n, label: String(n), round: true })),
          { value: 0, label: t.onboarding.noGoal },
          { value: CUSTOM, label: t.onboarding.customGoal },
        ]}
      />
      {custom ? (
        <Input
          value={text}
          onChangeText={type}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          autoFocus
          accessibilityLabel={t.onboarding.weeklyGoal}
          placeholder={String(value || 3)}
          hint={t.onboarding.customGoalHint(WEEKLY_GOAL_MAX)}
          style={{ width: 96 }}
        />
      ) : null}
    </View>
  );
}
