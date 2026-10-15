import { useQueryClient } from "@tanstack/react-query";
import Camera from "lucide-react-native/icons/camera";
import { useState } from "react";
import { View } from "react-native";

import { pickAndUploadAvatar, removeAvatar } from "@/lib/avatar";
import { confirm } from "@/lib/confirm";
import { useMe } from "@/lib/queries";
import { isMinor } from "@/shared/domain";

import { Avatar, Button, ErrorText, Row, Txt } from "./kit";
import { space } from "./theme";

/** The person's own photo with change / remove. Minors keep their initials (the API refuses photos for them). */
export function AvatarEditor() {
  const qc = useQueryClient();
  const me = useMe().data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const profile = me?.profile;
  if (!profile) return null;
  const minor = isMinor(profile.birthYear);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      // The photo shows up next to the person everywhere: refresh what lists people.
      await Promise.all(["me", "profile", "feed", "session", "academy", "notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <Row gap={space.lg}>
        <Avatar uri={profile.avatarUrl} name={profile.name} size={72} />
        {minor ? (
          <Txt v="small" muted style={{ flex: 1 }}>Para proteger menores de idade, o perfil usa as iniciais em vez de foto.</Txt>
        ) : (
          <Row gap={space.sm} wrap style={{ flex: 1 }}>
            <Button size="sm" icon={Camera} title={profile.avatarUrl ? "Trocar foto" : "Escolher foto"} loading={busy} onPress={() => run(pickAndUploadAvatar)} />
            {profile.avatarUrl ? (
              <Button
                size="sm"
                kind="ghost"
                title="Remover"
                disabled={busy}
                onPress={async () => {
                  if (await confirm("Remover a foto?", "O perfil volta a mostrar as suas iniciais.", "Remover")) void run(removeAvatar);
                }}
              />
            ) : null}
          </Row>
        )}
      </Row>
      <ErrorText error={error} />
    </View>
  );
}
