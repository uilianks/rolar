import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";

import { useT } from "@/lib/i18n";
import { Button } from "@/ui/kit";
import { ProfileView } from "@/ui/profile-view";
import { Header, Screen } from "@/ui/shell";

export default function UserProfile() {
  const t = useT();
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <>
      <Header
        title={`@${username}`}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <Screen>
        <ProfileView username={username} />
      </Screen>
    </>
  );
}
