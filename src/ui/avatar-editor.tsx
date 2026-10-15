import { useQueryClient } from "@tanstack/react-query";
import Camera from "lucide-react-native/icons/camera";
import { useState } from "react";
import { View } from "react-native";

import { pickImage, removeAvatar, uploadAvatar, type PickedImage } from "@/lib/avatar";
import { confirm } from "@/lib/confirm";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { isMinor } from "@/shared/domain";

import { AvatarCropper } from "./avatar-cropper";
import { Avatar, Button, ErrorText, Row, Txt } from "./kit";
import { space } from "./theme";

/** The person's own photo with change / remove. Minors keep their initials (the API refuses photos for them). */
export function AvatarEditor() {
  const t = useT();
  const qc = useQueryClient();
  const me = useMe().data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
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
          <Txt v="small" muted style={{ flex: 1 }}>{t.avatar.minorHint}</Txt>
        ) : (
          <Row gap={space.sm} wrap style={{ flex: 1 }}>
            <Button size="sm" icon={Camera} title={profile.avatarUrl ? t.avatar.change : t.avatar.choose} loading={busy} onPress={() => pickImage().then(setPicked, setError)} />
            {profile.avatarUrl ? (
              <Button
                size="sm"
                kind="ghost"
                title={t.common.remove}
                disabled={busy}
                onPress={async () => {
                  if (await confirm(t.avatar.removeTitle, t.avatar.removeText, t.common.remove)) void run(removeAvatar);
                }}
              />
            ) : null}
          </Row>
        )}
      </Row>
      <ErrorText error={error} />
      {picked ? (
        <AvatarCropper
          image={picked}
          onCancel={() => setPicked(null)}
          onDone={(rect) => {
            setPicked(null);
            void run(() => uploadAvatar(picked, rect));
          }}
        />
      ) : null}
    </View>
  );
}
