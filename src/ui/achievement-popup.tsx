// "Parabéns!": when an achievement is reached (after logging a session, marking a technique as known…)
// the app congratulates once. The server keeps which ones were shown, so it is once per account.
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import Award from "lucide-react-native/icons/award";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAchievements, useMe } from "@/lib/queries";

import { Button, Card, Txt } from "./kit";
import { space, useTheme } from "./theme";

export function AchievementPopup() {
  const t = useT();
  const { c } = useTheme();
  const qc = useQueryClient();
  const me = useMe().data;
  const list = useAchievements(!!me?.profile).data;
  // Shown in this session, so closing does not wait on the server to drop it.
  const [shown, setShown] = useState<string[]>([]);
  const fresh = (list ?? []).filter((a) => a.isNew && !shown.includes(a.id));
  const a = fresh[0];
  if (!a) return null;

  function close(thenOpen = false) {
    if (!a) return;
    setShown((ids) => [...ids, a.id]);
    void api("/me/achievements/seen", { method: "POST", json: { ids: [a.id] } }).then(() =>
      qc.invalidateQueries({ queryKey: ["stats", "achievements"] }),
    );
    if (thenOpen) router.push("/conquistas");
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={() => close()}>
      <Pressable
        accessibilityLabel={t.achievements.oss}
        onPress={() => close()}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: space.lg }}
      >
        {/* Swallows taps so only the backdrop closes. */}
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 360 }}>
          <Card style={{ gap: space.md, alignItems: "center" }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Award size={36} color="#fff" />
            </View>
            <Txt v="h3" style={{ textAlign: "center" }}>{t.achievements.congrats}</Txt>
            <Txt bold style={{ textAlign: "center" }}>{t.achievements.name(a.id, a.target)}</Txt>
            <Txt muted style={{ textAlign: "center" }}>{t.achievements.unlocked}</Txt>
            {fresh.length > 1 ? <Txt v="small" muted>{t.achievements.more(fresh.length - 1)}</Txt> : null}
            <Button kind="primary" size="lg" title={t.achievements.oss} onPress={() => close()} style={{ alignSelf: "stretch" }} />
            <Button kind="ghost" title={t.achievements.seeAll} onPress={() => close(true)} />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
