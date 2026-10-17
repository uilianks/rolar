// The viewer's private notes on a technique (technique page).
import { useQueryClient } from "@tanstack/react-query";
import Lock from "lucide-react-native/icons/lock";
import Pencil from "lucide-react-native/icons/pencil";
import { useState } from "react";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { TechniqueNotes } from "@/lib/types";
import { Button, Card, Col, ErrorText, Input, Row, Txt } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

export function TechniqueNotesCard({ techniqueId, notes }: { techniqueId: string; notes: TechniqueNotes | null }) {
  const t = useT();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(notes?.body ?? "");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function edit() {
    setBody(notes?.body ?? "");
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/techniques/${techniqueId}/notes`, { method: "PUT", json: { body } });
      await qc.invalidateQueries({ queryKey: ["technique", techniqueId] });
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  return (
    <Card style={{ gap: space.md }}>
      <Row gap={6}>
        <Lock size={14} color={c.mutedFg} />
        <Txt v="small" bold style={{ flex: 1 }}>{t.techniqueNotes.title}</Txt>
        {!editing ? <Button kind="ghost" size="sm" icon={Pencil} accessibilityLabel={t.techniqueNotes.edit} onPress={edit} /> : null}
      </Row>
      {editing ? (
        <Col gap={space.sm}>
          <Input value={body} onChangeText={setBody} placeholder={t.techniqueNotes.placeholder} multiline maxLength={5000} style={{ minHeight: 120 }} />
          <ErrorText error={error} />
          <Row>
            <Button kind="primary" title={t.common.save} loading={busy} onPress={save} />
            <Button kind="ghost" title={t.common.cancel} onPress={() => setEditing(false)} />
          </Row>
        </Col>
      ) : (
        <Txt v={notes ? undefined : "small"} muted={!notes}>{notes?.body ?? t.techniqueNotes.empty}</Txt>
      )}
    </Card>
  );
}
