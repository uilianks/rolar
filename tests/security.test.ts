import { afterAll, beforeAll, expect, it } from "vitest";

import { loadEnv } from "../server/env";
import { testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
beforeAll(async () => {
  api = await testApi();
});
afterAll(() => api.close());

it("refuses changes sent from another site, even with the session cookie (CSRF)", async () => {
  const victim = await api.user("vitima_csrf");
  const patch = (headers: Record<string, string>, name: string) =>
    api.request("/me/profile", { method: "PATCH", headers: { Cookie: victim.cookie, ...headers }, body: JSON.stringify({ name }) });

  // A form on evil.example posting to us: text/plain, Origin evil, cookie attached by an old browser.
  expect((await patch({ Origin: "https://evil.example", "Content-Type": "text/plain" }, "hacked")).status).toBe(403);
  // Sec-Fetch-Site without Origin (some privacy setups strip it) is refused too.
  expect((await api.request("/me/notifications/read", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site", Cookie: victim.cookie } })).status).toBe(403);
  // The web app itself, and the Android app (no Origin at all), still work.
  expect((await patch({ Origin: "http://localhost:8081", "Content-Type": "application/json" }, "Vítima")).status).toBe(200);
  expect((await patch({ "Content-Type": "application/json" }, "Vítima 2")).status).toBe(200);
  // Reads are left to the browser's CORS check: a GET never changes anything.
  expect((await api.request("/me", { method: "GET", headers: { Origin: "https://evil.example", Cookie: victim.cookie } })).status).toBe(200);
});

it("trusts only its own origin and the app in production, not the development web port", () => {
  const prod = loadEnv({ NODE_ENV: "production", BETTER_AUTH_URL: "https://rolar.app", BETTER_AUTH_SECRET: "x".repeat(40) });
  expect([...prod.TRUSTED_ORIGINS].sort()).toEqual(["https://rolar.app", "rolar://"]);
  expect(loadEnv({ NODE_ENV: "development" }).TRUSTED_ORIGINS).toContain("http://localhost:8081");
});
