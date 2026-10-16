import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { dateFmt, isoWeekday, monthYear, ymd } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { addMonths } from "@/shared/domain";
import { Button, Input, Row, Txt } from "@/ui/kit";
import { radius, space, useTheme } from "@/ui/theme";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD text field with a calendar button: tapping a day fills the field. */
export function DateField({
  label,
  value,
  onChange,
  hint,
  placeholder = "2026-11-21",
}: {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="small" bold>{label}</Txt> : null}
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Input value={value} onChangeText={onChange} placeholder={placeholder} maxLength={10} accessibilityLabel={label} />
        </View>
        <Button
          icon={CalendarDays}
          accessibilityLabel={t.calendar.pickDate}
          onPress={() => setOpen(true)}
        />
      </Row>
      {open ? (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            accessibilityLabel={t.common.cancel}
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: space.lg }}
          >
            {/* Swallows taps so only the backdrop closes. */}
            <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 380 }}>
              <MonthPicker
                title={label}
                value={ISO_DATE.test(value) ? value : null}
                onPick={(d) => {
                  onChange(d);
                  setOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {hint ? <Txt v="small" muted>{hint}</Txt> : null}
    </View>
  );
}

function MonthPicker({ title, value, onPick }: { title?: string; value: string | null; onPick: (date: string) => void }) {
  const t = useT();
  const { c } = useTheme();
  const today = ymd(new Date());
  const [month, setMonth] = useState((value ?? today).slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const lead = isoWeekday(new Date(`${month}-01T12:00:00`)) - 1;
  const cell = { width: `${100 / 7}%` as const, padding: 3 };

  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: space.sm, backgroundColor: c.card }}>
      {title ? <Txt v="h3" style={{ padding: space.sm, paddingBottom: space.md }}>{title}</Txt> : null}
      <View style={{ borderRadius: radius.xl, borderWidth: 2, borderColor: c.muted, padding: space.md, gap: space.md }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Button size="sm" kind="ghost" icon={ChevronLeft} accessibilityLabel={t.calendar.prevMonth} onPress={() => setMonth(addMonths(month, -1))} />
          <Txt bold>{monthYear(month).replace(/^./, (ch) => ch.toUpperCase())}</Txt>
          <Button size="sm" kind="ghost" icon={ChevronRight} accessibilityLabel={t.calendar.nextMonth} onPress={() => setMonth(addMonths(month, 1))} />
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5, 6, 7].map((w) => (
            <View key={`h-${w}`} style={[cell, { alignItems: "center", paddingBottom: space.xs }]}>
              <Txt v="tiny" muted bold style={{ textTransform: "uppercase" }}>{t.weekdayShort[w]}</Txt>
            </View>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <View key={`lead-${i}`} style={cell} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const on = date === value;
            return (
              <View key={date} style={cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.calendar.pickDay(dateFmt({ day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)))}
                  onPress={() => onPick(date)}
                  style={({ pressed }) => ({
                    height: 36,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? c.accent : date === today ? c.muted : pressed ? c.accentSoft : "transparent",
                  })}
                >
                  <Txt v="small" bold={on || date === today} color={on ? "#fff" : date === today ? c.fg : c.mutedFg}>
                    {i + 1}
                  </Txt>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
