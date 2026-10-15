import { router } from "expo-router";
import Settings from "lucide-react-native/icons/settings";
import ShieldCheck from "lucide-react-native/icons/shield-check";

import { useMe } from "@/lib/queries";
import { Button, Row } from "@/ui/kit";
import { ProfileView } from "@/ui/profile-view";
import { Header, Screen, useWide } from "@/ui/shell";

export default function MyProfile() {
  const me = useMe().data;
  const username = me?.profile?.username ?? "";
  const wide = useWide();
  const pending = me?.admin ? me.admin.pendingAcademies + me.admin.openReports : 0;
  return (
    <>
      <Header
        title="Perfil"
        right={
          <Row gap={4}>
            {/* Wide screens reach admin from the sidebar; phones have no sidebar, so it lives here. */}
            {me?.admin && !wide ? (
              <Button kind={pending ? "accent" : "ghost"} icon={ShieldCheck} title={pending ? String(pending) : undefined} accessibilityLabel="Admin" onPress={() => router.push("/admin")} size={pending ? "sm" : "md"} />
            ) : null}
            <Button kind="ghost" icon={Settings} accessibilityLabel="Configurações" onPress={() => router.push("/config")} />
          </Row>
        }
      />
      <Screen>{username ? <ProfileView username={username} /> : null}</Screen>
    </>
  );
}
