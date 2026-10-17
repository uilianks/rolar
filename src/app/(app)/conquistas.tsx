import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";

import { useT } from "@/lib/i18n";
import { useAchievements } from "@/lib/queries";
import type { Achievement } from "@/lib/types";
import { AchievementRow } from "@/ui/achievements";
import { Button, Card, CardHead, Col, ErrorText, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

const GROUPS: Achievement["group"][] = ["sessions", "hours", "streak", "submissions", "variety", "techniques"];

export default function AchievementsScreen() {
  const t = useT();
  const query = useAchievements();
  const list = query.data;
  return (
    <>
      <Header
        title={t.achievements.title}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/progresso"))} />}
        right={list ? <Txt v="small" muted>{t.achievements.count(list.filter((a) => a.achievedAt).length, list.length)}</Txt> : undefined}
      />
      <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        {query.isPending ? <Loading /> : null}
        <ErrorText error={query.error} />
        {list
          ? GROUPS.map((g) => (
              <Card key={g} pad={false}>
                <CardHead title={t.achievements.groups[g]} />
                <Col style={{ padding: space.lg }}>
                  {list
                    .filter((a) => a.group === g)
                    .map((a) => (
                      <AchievementRow key={a.id} a={a} />
                    ))}
                </Col>
              </Card>
            ))
          : null}
      </Screen>
    </>
  );
}
