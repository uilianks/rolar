import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Search from "lucide-react-native/icons/search";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { useFeed } from "@/lib/queries";
import { Button, Card, Empty, ErrorText, Loading, Row, Tabs } from "@/ui/kit";
import { SessionCardView } from "@/ui/session-card";
import { Header, Screen } from "@/ui/shell";

/** Sessions from people you follow and from your academy; off the home screen on purpose. */
export default function Feed() {
  const t = useT();
  const [scope, setScope] = useState<"following" | "academy" | "me">("following");
  const feed = useFeed(scope);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Header
        title={t.nav.feed}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={<Button kind="ghost" icon={Search} accessibilityLabel={t.search.title} onPress={() => router.push("/buscar")} />}
      />
      <Screen
        onRefresh={() => feed.refetch()}
        refreshing={feed.isRefetching}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
      >
        <Tabs
          value={scope}
          onChange={setScope}
          options={[
            { value: "following", label: t.feed.following },
            { value: "academy", label: t.feed.myAcademy },
            { value: "me", label: t.feed.me },
          ]}
        />
        {feed.isPending ? <Loading /> : null}
        <ErrorText error={feed.error} />
        {items.map((s) => (
          <SessionCardView key={s.id} s={s} />
        ))}
        {feed.isFetchingNextPage ? <Loading /> : null}
        {!feed.isPending && items.length === 0 ? (
          scope === "academy" ? (
            <Card>
              <Empty icon={Users} title={t.feed.academyEmpty} text={t.feed.academyEmptyText} action={<Button size="sm" title={t.feed.seeAcademy} onPress={() => router.navigate("/academia")} />} />
            </Card>
          ) : (
            <Card>
              <Empty
                icon={Timer}
                title={t.feed.empty}
                text={t.feed.emptyText}
                action={
                  <Row>
                    <Button size="sm" kind="primary" title={t.nav.logSession} onPress={() => router.navigate("/registrar")} />
                    <Button size="sm" title={t.search.title} onPress={() => router.push("/buscar")} />
                  </Row>
                }
              />
            </Card>
          )
        ) : null}
      </Screen>
    </>
  );
}
