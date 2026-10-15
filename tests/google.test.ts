import { afterAll, beforeAll, expect, it } from "vitest";

import { testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
beforeAll(async () => {
  api = await testApi({ GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "test-secret" });
});
afterAll(() => api.close());

it("sends people to Google with the API callback, and back to the web app afterwards", async () => {
  const res = await api.call("POST", "/auth/sign-in/social", {
    json: { provider: "google", callbackURL: "http://localhost:8081/", errorCallbackURL: "http://localhost:8081/entrar" },
  });
  expect(res.status).toBe(200);
  const url = new URL(res.data.url);
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("client_id")).toBe("test-client.apps.googleusercontent.com");
  // This exact URL must be registered as an authorized redirect URI in Google Cloud.
  expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8799/api/auth/callback/google");
  expect(url.searchParams.get("scope")).toContain("email");
});

// Better Auth also refuses callback URLs outside TRUSTED_ORIGINS (no open redirect after Google), but it
// skips that check when NODE_ENV=test, so it cannot be asserted here. Checked by hand with
// NODE_ENV=development (15/10/2026): http://localhost:8081/ → 200, rolar:// → 200, https://evil.example/ → 403.
