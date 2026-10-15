import { router } from "expo-router";
import Settings from "lucide-react-native/icons/settings";

import { useMe } from "@/lib/queries";
import { Button } from "@/ui/kit";
import { ProfileView } from "@/ui/profile-view";
import { Header, Screen } from "@/ui/shell";

export default function MyProfile() {
  const username = useMe().data?.profile?.username ?? "";
  return (
    <>
      <Header title="Perfil" right={<Button kind="ghost" icon={Settings} accessibilityLabel="Configurações" onPress={() => router.push("/config")} />} />
      <Screen>{username ? <ProfileView username={username} /> : null}</Screen>
    </>
  );
}
