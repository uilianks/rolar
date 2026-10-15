// Onboarding unmounts as soon as the profile exists (the root layout swaps it for the app), so a route
// it wants to open next is handed over here and opened once the app area has mounted.
import type { Href } from "expo-router";

let next: Href | null = null;

export const handoff = {
  set(route: Href) {
    next = route;
  },
  take() {
    const route = next;
    next = null;
    return route;
  },
};
