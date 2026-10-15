import { afterAll, beforeAll, expect, it } from "vitest";

import { sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
beforeAll(async () => {
  api = await testApi();
});
afterAll(() => api.close());

// Smallest valid JPEG header bytes are enough: the API checks the signature, not the pixels.
const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64")}`;

it("stores a profile photo, serves it publicly and shows it next to the person", async () => {
  const ana = await api.user("ana_foto");
  const bia = await api.user("bia_foto");

  const put = await api.call("PUT", "/me/avatar", { cookie: ana.cookie, json: { image: jpeg } });
  expect(put.status).toBe(200);
  expect(put.data.avatarUrl).toMatch(new RegExp(`^/api/avatars/${ana.id}\\?v=`));

  const img = await api.call("GET", `/avatars/${ana.id}`);
  expect(img.status).toBe(200);
  expect(img.headers.get("content-type")).toBe("image/jpeg");
  expect(img.headers.get("cache-control")).toContain("immutable");

  // Everywhere the person appears: profile, session cards.
  expect((await api.call("GET", "/users/ana_foto", { cookie: bia.cookie })).data.avatarUrl).toBe(put.data.avatarUrl);
  await api.call("POST", "/sessions", { cookie: ana.cookie, json: sessionBody({ visibility: "public" }) });
  const feed = await api.call("GET", "/feed?scope=me", { cookie: ana.cookie });
  expect(feed.data.items[0].author.avatarUrl).toBe(put.data.avatarUrl);

  // A new photo gets a new URL (caches never show the old one); removing it goes back to initials.
  await new Promise((r) => setTimeout(r, 5));
  const again = await api.call("PUT", "/me/avatar", { cookie: ana.cookie, json: { image: jpeg } });
  expect(again.data.avatarUrl).not.toBe(put.data.avatarUrl);
  expect((await api.call("GET", "/me/export", { cookie: ana.cookie })).data.avatar.mime).toBe("image/jpeg");
  expect((await api.call("DELETE", "/me/avatar", { cookie: ana.cookie })).status).toBe(204);
  expect((await api.call("GET", `/avatars/${ana.id}`)).status).toBe(404);
  expect((await api.call("GET", "/users/ana_foto", { cookie: bia.cookie })).data.avatarUrl).toBeNull();
});

it("rejects files that are not images, oversized ones, and minors", async () => {
  const caio = await api.user("caio_foto");
  const fake = `data:image/jpeg;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
  expect((await api.call("PUT", "/me/avatar", { cookie: caio.cookie, json: { image: fake } })).status).toBe(400);
  expect((await api.call("PUT", "/me/avatar", { cookie: caio.cookie, json: { image: "data:image/svg+xml;base64,PHN2Zz4=" } })).status).toBe(400);
  const huge = `data:image/jpeg;base64,${Buffer.alloc(200_000, 0xff).toString("base64")}`;
  expect((await api.call("PUT", "/me/avatar", { cookie: caio.cookie, json: { image: huge } })).status).toBe(400);
  expect((await api.call("PUT", "/me/avatar", { json: { image: jpeg } })).status).toBe(401);

  const teen = await api.user("teen_foto", { birthYear: new Date().getFullYear() - 15 });
  expect((await api.call("PUT", "/me/avatar", { cookie: teen.cookie, json: { image: jpeg } })).status).toBe(403);
});
