import { Stack } from "expo-router";
import ShieldOff from "lucide-react-native/icons/shield-off";

import { useMe } from "@/lib/queries";
import { Card, Empty, Loading } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";

/** Admin area: the API enforces access; this only avoids showing an empty panel to everyone else. */
export default function AdminLayout() {
  const me = useMe();
  if (me.isPending) return <Loading />;
  if (!me.data?.admin) {
    return (
      <>
        <Header title="Admin" />
        <Screen>
          <Card>
            <Empty icon={ShieldOff} title="Acesso restrito" text="Esta área é só para administradores." />
          </Card>
        </Screen>
      </>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
