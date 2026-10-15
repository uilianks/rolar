// Small per-device preferences (theme, timer preset). Not for anything that must sync.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PREFIX = "rolar_pref_";

export const prefs = {
  async get(key: string): Promise<string | null> {
    try {
      return Platform.OS === "web" ? localStorage.getItem(PREFIX + key) : await SecureStore.getItemAsync(PREFIX + key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      if (Platform.OS === "web") localStorage.setItem(PREFIX + key, value);
      else await SecureStore.setItemAsync(PREFIX + key, value);
    } catch {
      // Preferences are a convenience; failing to store one is not an error for the user.
    }
  },
};
