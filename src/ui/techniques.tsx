import { Pressable, View } from "react-native";

import { useT } from "@/lib/i18n";
import { TECHNIQUE_CATEGORIES, type TechniqueCategory } from "@/shared/domain";

import { Row, Txt } from "./kit";
import { radius, space, TECHNIQUE_COLORS, useTheme } from "./theme";

/** Where a technique of this catalog is added (an academy's, or Rolar's from the admin panel). */
export const newTechniqueHref = (academyId: string | null) => (academyId ? `/academia/${academyId}/tecnica` : "/admin/tecnicas?catalogo=rolar");

export const editTechniqueHref = (academyId: string | null, id: string) =>
  academyId ? `/academia/${academyId}/tecnica?techniqueId=${id}` : `/admin/tecnicas?techniqueId=${id}`;

/** The map of a technique's catalog. */
export const techniqueMapHref = (academyId: string | null, focus?: string) =>
  (academyId ? `/academia/${academyId}/mapa` : "/tecnicas/mapa?escopo=rolar") + (focus ? `${academyId ? "?" : "&"}focus=${focus}` : "");

export function CategoryDot({ category, size = 10 }: { category: TechniqueCategory; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: TECHNIQUE_COLORS[category] }} />;
}

export function CategoryLegend() {
  const t = useT();
  return (
    <Row wrap gap={space.md}>
      {TECHNIQUE_CATEGORIES.map((k) => (
        <Row key={k} gap={5}>
          <CategoryDot category={k} size={8} />
          <Txt v="tiny" muted>{t.techniqueCategory[k]}</Txt>
        </Row>
      ))}
    </Row>
  );
}

/** A technique as a pill: category dot and name, optionally with a muted note, selectable or pressable. */
export function TechniqueChip({
  name,
  category,
  note,
  selected,
  onPress,
}: {
  name: string;
  category?: TechniqueCategory;
  note?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primary : pressed ? c.muted : "transparent",
      })}
    >
      {category ? <CategoryDot category={category} size={8} /> : null}
      <Txt v="small" bold color={selected ? c.primaryFg : undefined}>{name}</Txt>
      {note ? <Txt v="tiny" muted>{note}</Txt> : null}
    </Pressable>
  );
}
