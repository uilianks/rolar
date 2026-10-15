import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import Trash from "lucide-react-native/icons/trash";
import { useState } from "react";
import { View } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { endTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAcademy, useClasses } from "@/lib/queries";
import type { AcademyClass } from "@/lib/types";
import { classInput, SESSION_KINDS, type SessionKind } from "@/shared/domain";
import { validationMessage } from "@/shared/i18n";
import { Button, Card, CardHead, Col, Empty, ErrorText, Input, ListRow, Loading, Segmented, Stepper, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const EMPTY = { weekday: 1, startTime: "19:00", durationMin: 90, title: "", kind: "gi" as SessionKind };

/** Staff edit the weekly timetable shown on the academy page. */
export default function Timetable() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const academy = useAcademy(id);
  const classes = useClasses(academy.data?.id);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const a = academy.data;
  const staff = a?.membership?.status === "active" && a.membership.role !== "student";

  function edit(k: AcademyClass) {
    setEditing(k.id);
    setForm({ weekday: k.weekday, startTime: k.startTime, durationMin: k.durationMin, title: k.title, kind: k.kind });
    setError(null);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["academy", a?.id, "classes"] });
  }

  async function save() {
    setError(null);
    const check = classInput.safeParse(form);
    if (!check.success) return setError(validationMessage(t, check.error.issues[0].message));
    setBusy(true);
    try {
      await api(editing ? `/academies/${a!.id}/classes/${editing}` : `/academies/${a!.id}/classes`, { method: editing ? "PUT" : "POST", json: check.data });
      await refresh();
      setEditing(null);
      setForm({ ...EMPTY, weekday: form.weekday });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(k: AcademyClass) {
    if (!(await confirm(t.scheduleEdit.removeTitle(k.title), t.scheduleEdit.removeText, t.common.remove))) return;
    try {
      await api(`/academies/${a!.id}/classes/${k.id}`, { method: "DELETE" });
      if (editing === k.id) setEditing(null);
      await refresh();
    } catch (e) {
      setError(e);
    }
  }

  if (academy.isPending) return <Loading />;
  if (!a) return <ErrorText error={academy.error} />;

  return (
    <>
      <Header
        title={t.academy.schedule}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${a.id}`))} />}
      />
      <Screen>
        <Col gap={4}>
          <Txt v="h1">{a.name}</Txt>
          <Txt muted>{t.scheduleEdit.intro}</Txt>
        </Col>

        {!staff ? (
          <Card>
            <Txt muted>{t.scheduleEdit.coachesOnly}</Txt>
          </Card>
        ) : (
          <>
            <Card pad={false}>
              <CardHead title={editing ? t.scheduleEdit.editClass : t.scheduleEdit.newClass} />
              <Col style={{ padding: space.lg }}>
                <Segmented label={t.scheduleEdit.day} value={form.weekday} onChange={(weekday) => setForm({ ...form, weekday })} options={DAYS.map((d) => ({ value: d, label: t.weekdayShort[d] }))} />
                <Input label={t.scheduleEdit.className} value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder={t.scheduleEdit.classNamePlaceholder} />
                <Input label={t.scheduleEdit.start} value={form.startTime} onChangeText={(startTime) => setForm({ ...form, startTime })} placeholder="19:00" maxLength={5} />
                <Stepper label={t.log.durationMin} value={form.durationMin} onChange={(durationMin) => setForm({ ...form, durationMin })} step={15} min={15} max={300} />
                <Segmented label={t.session.kind} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={SESSION_KINDS.map((k) => ({ value: k, label: t.sessionKind[k] }))} />
                <ErrorText error={error} />
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Button kind="primary" icon={editing ? Pencil : Plus} title={editing ? t.eventForm.saveChanges : t.scheduleEdit.addClass} loading={busy} onPress={save} />
                  {editing ? <Button title={t.common.cancel} onPress={() => { setEditing(null); setForm(EMPTY); }} /> : null}
                </View>
              </Col>
            </Card>

            <Card pad={false}>
              <CardHead title={t.scheduleEdit.week} />
              {classes.isPending ? <Loading /> : null}
              {classes.data?.length === 0 ? <Empty icon={Plus} title={t.scheduleEdit.noClasses} text={t.scheduleEdit.noClassesText} /> : null}
              {(classes.data ?? []).map((k) => (
                <ListRow key={k.id} onPress={() => edit(k)} highlight={editing === k.id}>
                  <View style={{ flex: 1 }}>
                    <Txt bold>{k.title}</Txt>
                    <Txt v="tiny" muted>
                      {t.weekday[k.weekday]} · {k.startTime}–{endTime(k.startTime, k.durationMin)} · {t.sessionKind[k.kind]}
                    </Txt>
                  </View>
                  <Button size="sm" kind="ghost" icon={Trash} accessibilityLabel={t.scheduleEdit.removeA11y(k.title)} onPress={() => remove(k)} />
                </ListRow>
              ))}
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}
