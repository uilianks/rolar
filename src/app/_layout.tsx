import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { handoff } from "@/lib/handoff";
import { useMe } from "@/lib/queries";
import { Loading } from "@/ui/kit";
import { ThemeProvider, useTheme } from "@/ui/theme";

// A check-in QR scanned while signed out (or before onboarding) resumes once the app area opens.
if (Platform.OS === "web" && typeof window !== "undefined" && window.location.pathname === "/checkin") {
  handoff.set({ pathname: "/checkin", params: Object.fromEntries(new URLSearchParams(window.location.search)) });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

/** Three states: signed out → entrar; signed in without profile → onboarding; ready → the app. */
function Gate() {
  const { c, scheme } = useTheme();
  // Better Auth re-checks the session when the tab regains focus, and while it does a signed-out
  // session reports isPending again. Only the first check may cover the screen, or switching to the
  // e-mail app to copy the code would reset the login form.
  const { data: session, isPending, isRefetching } = authClient.useSession();
  const me = useMe();
  const unauthorized = me.error instanceof ApiError && me.error.status === 401;
  const signedIn = !!session && !unauthorized;

  if ((isPending && !isRefetching) || (signedIn && me.isPending)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  }

  const ready = signedIn && !!me.data?.profile;
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavThemeProvider value={{ ...base, colors: { ...base.colors, background: c.bg, card: c.bg, border: c.border, text: c.fg } }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !ready}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Gate />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
