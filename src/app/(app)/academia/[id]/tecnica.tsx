import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useState } from "react";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useStaffAcademies, useTechnique, useTechniques } from "@/lib/queries";
import type { TechniqueDetail } from "@/lib/types";
import { TECHNIQUE_CATEGORIES, TECHNIQUE_POSITIONS, techniqueInput, type TechniqueCategory, type TechniquePosition } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Button, Card, Col, ErrorText, Input, Loading, Row, Segmented, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { TechniqueChip } from "@/ui/techniques";
import { space, useTheme } from "@/ui/theme";

/** Create a technique for the academy, or edit one (`?techniqueId=`). Staff only; the API enforces it. */
export default function TechniqueFormScreen() {
  const { id, techniqueId } = useLocalSearchParams<{ id: string; techniqueId?: string }>();
  const existing = useTechnique(techniqueId);
  if (techniqueId && existing.isPending) return <Loading />;
  return <TechniqueForm academyId={id} existing={existing.data} />;
}

function TechniqueForm({ academyId: initialAcademy, existing }: { academyId: string; existing?: TechniqueDetail }) {
  const t = useT();
  const qc = useQueryClient();
  // A coach of several academies picks where a new technique goes; an edit stays where it is.
  const staffAt = useStaffAcademies();
  const [academyId, setAcademyId] = useState(existing?.academy.id ?? initialAcademy);
  const [saved, setSaved] = useState<string | null>(null);
  const { c } = useTheme();
  const [name, setName] = useState(existing?.name ?? "");
  const [aliases, setAliases] = useState(existing?.aliases.join(", ") ?? "");
  const [category, setCategory] = useState<TechniqueCategory>(existing?.category ?? "submission");
  const [position, setPosition] = useState<TechniquePosition | "">(existing?.position ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [leadsTo, setLeadsTo] = useState<string[]>(existing?.leadsTo.map((k) => k.id) ?? []);
  const others = (useTechniques({ academy: academyId }).data ?? []).filter((k) => k.id !== existing?.id);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function pickAcademy(id: string) {
    setAcademyId(id);
    setLeadsTo([]);
  }

  const toggle = (target: string) => setLeadsTo((ids) => (ids.includes(target) ? ids.filter((x) => x !== target) : [...ids, target]));

  /** `another`: stay on the form, cleared, to add the next technique (category and position kept). */
  async function save(another = false) {
    setError(null);
    setSaved(null);
    const check = techniqueInput.safeParse({
      name,
      aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
      category,
      position: position || null,
      description,
      leadsTo,
    });
    if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    setBusy(true);
    try {
      const r = existing
        ? (await api(`/techniques/${existing.id}`, { method: "PUT", json: check.data }), { id: existing.id })
        : await api<{ id: string }>(`/academies/${academyId}/techniques`, { method: "POST", json: check.data });
      await Promise.all([qc.invalidateQueries({ queryKey: ["techniques"] }), qc.invalidateQueries({ queryKey: ["technique"] })]);
      if (another) {
        setSaved(check.data.name);
        setName("");
        setAliases("");
        setDescription("");
        setLeadsTo([]);
        setBusy(false);
      } else if (existing && router.canGoBack()) router.back();
      else router.replace(`/tecnicas/${r.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title={existing ? t.techniques.edit : t.techniques.new}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/tecnicas?academia=${academyId}`))} />}
      />
      <Screen>
        <Card style={{ gap: space.md }}>
          {!existing && staffAt.length > 1 ? (
            <Segmented label={t.techniques.academy} value={academyId} onChange={pickAcademy} options={staffAt.map((a) => ({ value: a.id, label: a.name }))} />
          ) : null}
          <Input label={t.techniques.name} value={name} onChangeText={setName} placeholder={t.techniques.namePlaceholder} maxLength={80} />
          <Input label={t.techniques.aliases} value={aliases} onChangeText={setAliases} hint={t.techniques.aliasesHint} />
          <Segmented label={t.techniques.category} value={category} onChange={setCategory} options={TECHNIQUE_CATEGORIES.map((k) => ({ value: k, label: t.techniqueCategory[k] }))} />
          <Segmented
            label={t.techniques.position}
            value={position}
            onChange={setPosition}
            options={[{ value: "" as const, label: t.techniques.anyPosition }, ...TECHNIQUE_POSITIONS.map((p) => ({ value: p, label: t.techniquePosition[p] }))]}
          />
          <Input label={t.techniques.description} value={description} onChangeText={setDescription} placeholder={t.techniques.descriptionPlaceholder} multiline maxLength={10_000} style={{ minHeight: 160 }} />
          {others.length ? (
            <Col gap={space.sm}>
              <Txt v="small" bold>{t.techniques.leadsTo}</Txt>
              <Row wrap gap={6}>
                {others.map((k) => (
                  <TechniqueChip key={k.id} name={k.name} category={k.category} selected={leadsTo.includes(k.id)} onPress={() => toggle(k.id)} />
                ))}
              </Row>
              <Txt v="small" muted>{t.techniques.leadsToHint}</Txt>
            </Col>
          ) : null}
          <ErrorText error={error} />
          {saved ? <Txt v="small" color={c.success}>{t.techniques.saved(saved)}</Txt> : null}
          <Button kind="primary" size="lg" title={t.techniques.save} loading={busy} onPress={() => save()} />
          {!existing ? <Button size="lg" title={t.techniques.saveAndNew} disabled={busy} onPress={() => save(true)} /> : null}
        </Card>
      </Screen>
    </>
  );
}
