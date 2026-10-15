import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
let adminCookie: string;
beforeAll(async () => {
  api = await testApi();
  // Signed in without a profile, so helpers that create the "admin" profile still work.
  adminCookie = await api.signIn("admin@example.com");
});
afterAll(() => api.close());

const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64")}`;
const asAdmin = (method: string, path: string, json?: unknown) => api.call(method, path, { cookie: adminCookie, json });

describe("admin access", () => {
  it("refuses every admin route to other users", async () => {
    const u = await api.user("curioso");
    for (const [method, path] of [
      ["GET", "/admin/reports"],
      ["POST", "/admin/reports/resolve"],
      ["GET", "/admin/users"],
      ["POST", `/admin/users/${u.id}/suspend`],
      ["PUT", "/admin/flags/beta"],
      ["GET", "/admin/stats"],
      ["PATCH", "/admin/academies/x"],
    ]) {
      expect((await api.call(method, path, { cookie: u.cookie, json: method === "GET" ? undefined : {} })).status).toBe(403);
    }
  });
});

describe("reports", () => {
  it("groups reports by target, removes the content and tells reporters and owner", async () => {
    const owner = await api.user("dono_treino");
    const r1 = await api.user("denuncia_1");
    const r2 = await api.user("denuncia_2");
    const session = await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ visibility: "public", notes: "spam spam" }) });
    for (const r of [r1, r2]) {
      await api.call("POST", "/reports", { cookie: r.cookie, json: { targetType: "session", targetId: session.data.id, reason: "spam" } });
    }

    expect((await asAdmin("GET", "/me")).data.admin.openReports).toBe(1);
    const queue = await asAdmin("GET", "/admin/reports");
    const group = queue.data.find((g: any) => g.targetId === session.data.id);
    expect(group).toMatchObject({ targetType: "session", count: 2, reasons: ["spam", "spam"] });
    expect(group.target).toMatchObject({ body: "spam spam", owner: { username: "dono_treino" } });

    // Profiles are suspended, never "removed"; suspending needs a reason.
    expect((await asAdmin("POST", "/admin/reports/resolve", { targetType: "user", targetId: owner.id, action: "remove" })).status).toBe(400);
    expect((await asAdmin("POST", "/admin/reports/resolve", { targetType: "session", targetId: session.data.id, action: "suspend" })).status).toBe(400);

    const res = await asAdmin("POST", "/admin/reports/resolve", { targetType: "session", targetId: session.data.id, action: "remove" });
    expect(res.status).toBe(204);
    expect((await api.call("GET", `/sessions/${session.data.id}`, { cookie: owner.cookie })).status).toBe(404);
    expect((await asAdmin("GET", "/me")).data.admin.openReports).toBe(0);
    // Deciding twice is refused.
    expect((await asAdmin("POST", "/admin/reports/resolve", { targetType: "session", targetId: session.data.id, action: "dismiss" })).status).toBe(409);

    const history = await asAdmin("GET", "/admin/reports?status=resolved");
    expect(history.data.find((g: any) => g.targetId === session.data.id)).toMatchObject({ action: "remove", count: 2, target: null });
    for (const r of [r1, r2]) {
      expect((await api.call("GET", "/me/notifications", { cookie: r.cookie })).data.map((n: any) => n.type)).toContain("report_resolved");
    }
    expect((await api.call("GET", "/me/notifications", { cookie: owner.cookie })).data.map((n: any) => n.type)).toContain("content_removed");
  });

  it("removes a reported profile photo", async () => {
    const owner = await api.user("foto_feia");
    const r = await api.user("viu_foto");
    await api.call("PUT", "/me/avatar", { cookie: owner.cookie, json: { image: jpeg } });
    await api.call("POST", "/reports", { cookie: r.cookie, json: { targetType: "user", targetId: owner.id, reason: "foto imprópria" } });
    expect((await asAdmin("POST", "/admin/reports/resolve", { targetType: "user", targetId: owner.id, action: "remove_avatar" })).status).toBe(204);
    expect((await api.call("GET", `/avatars/${owner.id}`)).status).toBe(404);
    expect((await api.call("GET", "/users/foto_feia", { cookie: r.cookie })).data.avatarUrl).toBeNull();
  });
});

describe("suspension", () => {
  it("signs the account out, blocks login and hides it until lifted", async () => {
    const bad = await api.user("suspenso");
    const other = await api.user("vizinho");
    expect((await api.call("POST", "/sessions", { cookie: bad.cookie, json: sessionBody({ visibility: "public" }) })).status).toBe(201);
    expect((await api.call("GET", "/users?q=suspenso", { cookie: other.cookie })).data).toHaveLength(1);

    expect((await asAdmin("POST", `/admin/users/${bad.id}/suspend`, { reason: "x" })).status).toBe(400);
    expect((await asAdmin("POST", `/admin/users/${bad.id}/suspend`, { reason: "Assédio a outros alunos" })).status).toBe(204);

    expect((await api.call("GET", "/me", { cookie: bad.cookie })).status).toBe(401);
    await expect(api.signIn("suspenso@example.com")).rejects.toThrow(/no session cookie \(status 403.*"code":"ACCOUNT_SUSPENDED".*"message":"Assédio/);
    expect((await api.call("GET", "/users?q=suspenso", { cookie: other.cookie })).data).toHaveLength(0);
    expect((await api.call("GET", "/users/suspenso", { cookie: other.cookie })).status).toBe(404);
    expect((await api.call("GET", "/users/suspenso/sessions", { cookie: other.cookie })).data.items).toHaveLength(0);

    const detail = await asAdmin("GET", `/admin/users/${bad.id}`);
    expect(detail.data).toMatchObject({ suspensionReason: "Assédio a outros alunos", sessions: 1, profile: { username: "suspenso", minor: false } });
    expect((await asAdmin("GET", "/admin/users?q=suspenso")).data[0].suspendedAt).not.toBeNull();

    expect((await asAdmin("DELETE", `/admin/users/${bad.id}/suspend`)).status).toBe(204);
    const cookie = await api.signIn("suspenso@example.com");
    expect((await api.call("GET", "/me", { cookie })).status).toBe(200);
    expect((await api.call("GET", "/users/suspenso", { cookie: other.cookie })).status).toBe(200);
  });

  it("never suspends an admin", async () => {
    const me = await asAdmin("GET", "/me");
    expect((await asAdmin("POST", `/admin/users/${me.data.user.id}/suspend`, { reason: "teste de segurança" })).status).toBe(409);
  });
});

describe("academy edits", () => {
  it("corrects an approved academy and transfers it to another account", async () => {
    const owner = await api.user("dono_antigo");
    const next = await api.user("dono_novo");
    const a = await api.approvedAcademy(owner.cookie, { name: "Academia Transferida", instagram: "transferida" });

    const edit = await asAdmin("PATCH", `/admin/academies/${a.id}`, {
      name: "Academia Transferida BJJ",
      address: "Rua Nova 20",
      city: "Porto",
      country: "pt",
      phone: "+351 220 000 000",
      website: "https://transferida.pt",
      instagram: "",
    });
    expect(edit.status).toBe(200);
    expect(edit.data).toMatchObject({ name: "Academia Transferida BJJ", city: "Porto", country: "PT", instagram: null, slug: a.slug, status: "approved" });

    expect((await asAdmin("POST", `/admin/academies/${a.id}/owner`, { username: "ninguem_aqui" })).status).toBe(404);
    expect((await asAdmin("POST", `/admin/academies/${a.id}/owner`, { username: "dono_novo" })).status).toBe(204);
    const members = await api.call("GET", `/academies/${a.id}/members`, { cookie: next.cookie });
    const role = (u: string) => members.data.find((m: any) => m.username === u)?.role;
    expect(role("dono_novo")).toBe("owner");
    expect(role("dono_antigo")).toBe("coach");
    expect((await asAdmin("GET", `/admin/academies/${a.id}`)).data.owner.username).toBe("dono_novo");
  });
});

describe("feature flags", () => {
  it("turns a flag on for listed users or for everyone", async () => {
    const beta = await api.user("testador");
    const other = await api.user("normal");
    const flags = async (cookie: string) => (await api.call("GET", "/me", { cookie })).data.flags;

    expect((await asAdmin("PUT", "/admin/flags/Bad Key", { enabledForAll: true })).status).toBe(400);
    expect((await asAdmin("PUT", "/admin/flags/timer-v2", { enabledForAll: false, usernames: ["nao_existe"] })).status).toBe(400);
    expect((await asAdmin("PUT", "/admin/flags/timer-v2", { enabledForAll: false, usernames: ["testador"] })).status).toBe(204);
    expect(await flags(beta.cookie)).toContain("timer-v2");
    expect(await flags(other.cookie)).not.toContain("timer-v2");
    expect((await asAdmin("GET", "/admin/flags")).data).toContainEqual({ key: "timer-v2", enabledForAll: false, usernames: ["testador"] });

    await asAdmin("PUT", "/admin/flags/timer-v2", { enabledForAll: true });
    expect(await flags(other.cookie)).toContain("timer-v2");
    await asAdmin("DELETE", "/admin/flags/timer-v2");
    expect(await flags(beta.cookie)).not.toContain("timer-v2");
  });
});

describe("stats", () => {
  it("counts accounts, activity and the last 8 weeks", async () => {
    const res = await asAdmin("GET", "/admin/stats");
    expect(res.status).toBe(200);
    expect(res.data.users).toBeGreaterThan(5);
    expect(res.data.users7d).toBe(res.data.users);
    expect(res.data.sessions7d).toBeGreaterThanOrEqual(1);
    expect(res.data.weeks).toHaveLength(8);
    expect(res.data.weeks.at(-1).signups).toBe(res.data.users);
  });
});
