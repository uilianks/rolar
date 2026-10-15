import { Stack } from "expo-router";
import ShieldOff from "lucide-react-native/icons/shield-off";

import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { Card, Empty, Loading } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";

/** Admin area: the API enforces access; this only avoids showing an empty panel to everyone else. */
export default function AdminLayout() {
  const t = useT();
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (!me.data?.admin) {
    return (
      <>
        <Header title={t.nav.admin} />
        <Screen>
          <Card>
            <Empty icon={ShieldOff} title={t.admin.restricted} text={t.admin.restrictedText} />
          </Card>
        </Screen>
      </>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
