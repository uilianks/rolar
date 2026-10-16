import { router, Stack, usePathname } from "expo-router";
import { useEffect } from "react";

import { handoff } from "@/lib/handoff";
import { ReviewPrompt } from "@/ui/review-prompt";
import { AppShell } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

export default function AppLayout() {
  const { c } = useTheme();
  const pathname = usePathname();
  useEffect(() => {
    const route = handoff.take();
    // Already there (e.g. signed in when the QR link opened): nothing to do.
    const target = typeof route === "string" ? route.split("?")[0] : route?.pathname;
    if (route && target !== pathname) router.push(route);
    // Only on mount: later navigation is the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
      <ReviewPrompt />
    </AppShell>
  );
}
