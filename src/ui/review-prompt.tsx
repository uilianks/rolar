// "How did it go?": after a class the athlete checked in to, the app asks once to fill in the session
// (intensity, techniques, notes) or skip. The check-in already logged it, so skipping loses nothing.
import { router, usePathname } from "expo-router";
import { useState } from "react";
import { Modal, Pressable } from "react-native";

import { when } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useMe, useSessionToReview, useSkipReview } from "@/lib/queries";

import { Button, Card, Col, Txt } from "./kit";
import { space } from "./theme";

export function ReviewPrompt() {
  const t = useT();
  const path = usePathname();
  const me = useMe().data;
  const review = useSessionToReview(!!me?.profile);
  const skip = useSkipReview();
  // "Later" (backdrop, back button) hides it until the app is opened again.
  const [later, setLater] = useState<string | null>(null);
  const s = review.data;
  if (!s || s.id === later || path.startsWith("/registrar") || path.startsWith("/checkin")) return null;

  function fill() {
    if (!s) return;
    setLater(s.id);
    router.push({ pathname: "/registrar", params: { sessionId: s.id } });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={() => setLater(s.id)}>
      <Pressable
        accessibilityLabel={t.review.later}
        onPress={() => setLater(s.id)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: space.lg }}
      >
        {/* Swallows taps so only the backdrop closes. */}
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 380 }}>
          <Card style={{ gap: space.md }}>
            <Col gap={4}>
              <Txt v="h3">{t.review.title}</Txt>
              <Txt bold>
                {s.title || t.sessionTitle(t.sessionKind[s.kind])}
                {s.academy ? ` · ${s.academy.name}` : ""}
              </Txt>
              <Txt v="small" muted>{when(s.startedAt)}</Txt>
            </Col>
            <Txt muted>{t.review.text}</Txt>
            <Button kind="primary" size="lg" title={t.review.fill} onPress={fill} />
            <Button title={t.review.skip} loading={skip.isPending} onPress={() => skip.mutate(s.id)} />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
