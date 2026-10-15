import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";

import { Button } from "@/ui/kit";
import { ProfileView } from "@/ui/profile-view";
import { Header, Screen } from "@/ui/shell";

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <>
      <Header
        title={`@${username}`}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <Screen>
        <ProfileView username={username} />
      </Screen>
    </>
  );
}
