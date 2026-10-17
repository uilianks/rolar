import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { tallyFinishes } from "../server/stats";
import { sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;

beforeAll(async () => {
  api = await testApi();
});
afterAll(() => api.close());

describe("submissions and taps", () => {
  it("are saved with the session, kept by partial edits and tallied in the stats", async () => {
    const u = await api.user("finalizador");
    const created = await api.call("POST", "/sessions", {
      cookie: u.cookie,
      json: sessionBody({ submissions: [{ name: "Armlock", count: 2 }, { name: "Mata-leão", count: 1 }], taps: [{ name: "Triângulo", count: 1 }] }),
    });
    expect(created.status).toBe(201);
    expect(created.data.submissions).toEqual([{ name: "Armlock", count: 2 }, { name: "Mata-leão", count: 1 }]);

    const edited = await api.call("PATCH", `/sessions/${created.data.id}`, { cookie: u.cookie, json: { title: "Rolas" } });
    expect(edited.data.taps).toEqual([{ name: "Triângulo", count: 1 }]);

    await api.call("POST", "/sessions", { cookie: u.cookie, json: sessionBody({ submissions: [{ name: "armlock", count: 1 }] }) });
    const stats = await api.call("GET", "/me/stats?tz=Europe/Lisbon", { cookie: u.cookie });
    expect(stats.data.submissions).toEqual({ total: 4, top: [{ name: "Armlock", count: 3 }, { name: "Mata-leão", count: 1 }] });
    expect(stats.data.taps.total).toBe(1);
  });

  it("refuses the same finish twice in one list", async () => {
    const u = await api.user("repetido");
    const res = await api.call("POST", "/sessions", {
      cookie: u.cookie,
      json: sessionBody({ submissions: [{ name: "Kimura", count: 1 }, { name: "kimura", count: 2 }] }),
    });
    expect(res.status).toBe(400);
  });

  it("tallies ignoring case and limits the top list", () => {
    const t = tallyFinishes([[{ name: "A", count: 1 }], [{ name: "a", count: 2 }, { name: "B", count: 5 }], undefined], 1);
    expect(t).toEqual({ total: 8, top: [{ name: "B", count: 5 }] });
  });
});
