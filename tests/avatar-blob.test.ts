import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { testApi } from "./helpers";

// In-memory stand-in for the private Blob store.
const store = vi.hoisted(() => new Map<string, { contentType: string; bytes: Uint8Array<ArrayBuffer> }>());
vi.mock("@vercel/blob", () => ({
  put: async (pathname: string, body: Uint8Array, opts: { contentType: string }) => {
    store.set(pathname, { contentType: opts.contentType, bytes: new Uint8Array(body) });
  },
  get: async (pathname: string) => {
    const b = store.get(pathname);
    return b ? { statusCode: 200, stream: new Response(b.bytes).body, blob: { contentType: b.contentType } } : null;
  },
  del: async (pathname: string) => {
    store.delete(pathname);
  },
}));

let api: Awaited<ReturnType<typeof testApi>>;
beforeAll(async () => {
  process.env.BLOB_STORE_ID = "store_test";
  api = await testApi();
});
afterAll(() => {
  delete process.env.BLOB_STORE_ID;
  return api.close();
});

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
const jpeg = `data:image/jpeg;base64,${jpegBytes.toString("base64")}`;

it("keeps photos in Blob, not in the database, and deletes them with the account", async () => {
  const ana = await api.user("ana_blob");
  expect((await api.call("PUT", "/me/avatar", { cookie: ana.cookie, json: { image: jpeg } })).status).toBe(200);
  expect(store.get(`avatars/${ana.id}`)?.contentType).toBe("image/jpeg");

  const img = await api.call("GET", `/avatars/${ana.id}`);
  expect(img.status).toBe(200);
  expect(img.headers.get("content-type")).toBe("image/jpeg");
  expect((await api.call("GET", "/me/export", { cookie: ana.cookie })).data.avatar.data).toBe(jpegBytes.toString("base64"));

  expect((await api.call("DELETE", "/me/avatar", { cookie: ana.cookie })).status).toBe(204);
  expect(store.has(`avatars/${ana.id}`)).toBe(false);
  expect((await api.call("GET", `/avatars/${ana.id}`)).status).toBe(404);

  const bia = await api.user("bia_blob");
  await api.call("PUT", "/me/avatar", { cookie: bia.cookie, json: { image: jpeg } });
  expect((await api.call("DELETE", "/me", { cookie: bia.cookie })).status).toBe(204);
  expect(store.has(`avatars/${bia.id}`)).toBe(false);
});
