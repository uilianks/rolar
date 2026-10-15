import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { currentLocale } from "./i18n";

/**
 * Where the API lives. On the deployed web app it is the page's own origin; in development and on
 * Android it comes from EXPO_PUBLIC_API_URL (e.g. http://localhost:8799 or the Vercel URL).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "http://10.0.2.2:8799");

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  // The login e-mail goes out in the app's language.
  fetchOptions: { onRequest: (ctx) => void ctx.headers.set("Accept-Language", currentLocale()) },
  plugins: [
    emailOTPClient(),
    expoClient({ scheme: "rolar", storagePrefix: "rolar", storage: SecureStore }),
  ],
});
