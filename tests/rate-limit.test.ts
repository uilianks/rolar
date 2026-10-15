import { afterAll, beforeAll, expect, it } from "vitest";

import { testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;

beforeAll(async () => {
  api = await testApi({ NODE_ENV: "production", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123" });
});
afterAll(() => api.close());

it("limits login codes per IP in production", async () => {
  const send = (ip: string) =>
    api.call("POST", "/auth/email-otp/send-verification-otp", { ip, json: { email: "spam@example.com", type: "sign-in" } });
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await send("203.0.113.7")).status);
  expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
  expect(statuses[5]).toBe(429);
  // Another address still gets through: the counter lives in the database, keyed by IP.
  expect((await send("203.0.113.8")).status).toBe(200);
});
