// Achievement badges (achievements screen, own profile) and the weekly challenges card (progress).
import { router } from "expo-router";
import Award from "lucide-react-native/icons/award";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flame from "lucide-react-native/icons/flame";
import Lock from "lucide-react-native/icons/lock";
import { Pressable, View } from "react-native";

import { dateFmt, duration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAchievements, useChallenges } from "@/lib/queries";
import type { Achievement, Challenge } from "@/lib/types";
import { Card, CardHead, Col, Progress, Row, Txt } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

export const achievedDate = (iso: string) => dateFmt({ day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export function AchievementRow({ a }: { a: Achievement }) {
  const t = useT();
  const { c } = useTheme();
  const got = !!a.achievedAt;
  const hint = t.achievements.hint(a.id);
  return (
    <Row gap={12} style={{ opacity: got ? 1 : 0.85 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: got ? c.accent : c.muted, alignItems: "center", justifyContent: "center" }}>
        {got ? <Award size={20} color="#fff" /> : <Lock size={16} color={c.mutedFg} />}
      </View>
      <Col gap={4} style={{ flex: 1 }}>
        <Txt bold={got}>{t.achievements.name(a.id, a.target)}</Txt>
        {got ? (
          <Txt v="small" muted>{t.achievements.on(achievedDate(a.achievedAt!))}</Txt>
        ) : (
          <>
            {a.target > 1 ? (
              <Row gap={8}>
                <View style={{ flex: 1 }}>
                  <Progress value={a.progress / a.target} height={6} />
                </View>
                <Txt v="tiny" muted>{a.progress}/{a.target}</Txt>
              </Row>
            ) : null}
            {hint ? <Txt v="small" muted>{hint}</Txt> : null}
          </>
        )}
      </Col>
    </Row>
  );
}

/** The latest achievements earned, linking to the full list (own profile). */
export function RecentAchievements() {
  const t = useT();
  const { c } = useTheme();
  const list = useAchievements().data;
  if (!list) return null;
  const got = list.filter((a) => a.achievedAt).sort((a, b) => b.achievedAt!.localeCompare(a.achievedAt!));
  return (
    <Card pad={false}>
      <CardHead
        title={t.achievements.recent}
        right={
          <Pressable accessibilityRole="link" onPress={() => router.push("/conquistas")}>
            <Row gap={2}>
              <Txt v="small" muted>{t.achievements.count(got.length, list.length)}</Txt>
              <ChevronRight size={14} color={c.mutedFg} />
            </Row>
          </Pressable>
        }
      />
      <Col style={{ padding: space.lg }}>
        {got.length ? got.slice(0, 3).map((a) => <AchievementRow key={a.id} a={a} />) : <Txt v="small" muted>{t.achievements.none}</Txt>}
      </Col>
    </Card>
  );
}

function challengeText(t: ReturnType<typeof useT>, ch: Challenge) {
  switch (ch.id) {
    case "sessions":
      return t.challenges.sessions(ch.target);
    case "minutes":
      return t.challenges.minutes(duration(ch.target));
    case "newKind":
      return t.challenges.newKind(ch.kind ? t.sessionKind[ch.kind] : "");
    case "submission":
      return t.challenges.submission;
    case "newTechnique":
      return t.challenges.newTechnique;
  }
}

export function ChallengesCard() {
  const t = useT();
  const { c } = useTheme();
  const data = useChallenges().data;
  const achievements = useAchievements().data;
  if (!data) return null;
  const got = achievements?.filter((a) => a.achievedAt).length ?? 0;
  return (
    <Card pad={false}>
      <CardHead
        title={t.challenges.title}
        right={
          achievements ? (
            <Pressable accessibilityRole="link" accessibilityLabel={t.achievements.title} onPress={() => router.push("/conquistas")}>
              <Row gap={4}>
                <Award size={14} color={c.mutedFg} />
                <Txt v="small" muted>{t.achievements.count(got, achievements.length)}</Txt>
                <ChevronRight size={14} color={c.mutedFg} />
              </Row>
            </Pressable>
          ) : undefined
        }
      />
      <Col style={{ padding: space.lg }}>
        {data.challenges.map((ch) => (
          <Row key={ch.id} gap={12}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: ch.done ? 0 : 2,
                borderColor: c.border,
                backgroundColor: ch.done ? c.success : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {ch.done ? <Check size={14} color="#fff" /> : null}
            </View>
            <Col gap={4} style={{ flex: 1 }}>
              <Txt style={ch.done ? { textDecorationLine: "line-through" } : undefined} muted={ch.done}>
                {challengeText(t, ch)}
              </Txt>
              {ch.target > 1 && !ch.done ? (
                <Row gap={8}>
                  <View style={{ flex: 1 }}>
                    <Progress value={ch.progress / ch.target} height={6} />
                  </View>
                  <Txt v="tiny" muted>{ch.id === "minutes" ? `${duration(ch.progress)}/${duration(ch.target)}` : `${ch.progress}/${ch.target}`}</Txt>
                </Row>
              ) : null}
            </Col>
          </Row>
        ))}
        {data.streakWeeks ? (
          <Row gap={6}>
            <Flame size={14} color={c.accent} />
            <Txt v="small">{t.challenges.streak(data.streakWeeks)}</Txt>
          </Row>
        ) : (
          <Txt v="small" muted>{t.challenges.hint}</Txt>
        )}
      </Col>
    </Card>
  );
}
