import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
let owner: { cookie: string; id: string };
let coach: { cookie: string; id: string };
let student: { cookie: string; id: string };
let outsider: { cookie: string; id: string };
let otherOwner: { cookie: string; id: string };
let academyId: string;
let otherAcademyId: string;

const tech = (name: string, extra: Record<string, unknown> = {}) => ({ name, category: "submission", ...extra });

beforeAll(async () => {
  api = await testApi();
  owner = await api.user("dono_tec");
  coach = await api.user("coach_tec");
  student = await api.user("aluno_tec");
  outsider = await api.user("fora_tec");
  otherOwner = await api.user("outro_tec");
  academyId = (await api.approvedAcademy(owner.cookie, { name: "Academia Técnicas", instagram: "tecnicas" })).id;
  otherAcademyId = (await api.approvedAcademy(otherOwner.cookie, { name: "Outra Academia", instagram: "outra_tec" })).id;
  for (const u of [coach, student]) {
    await api.call("POST", `/academies/${academyId}/join`, { cookie: u.cookie });
    await api.call("PATCH", `/academies/${academyId}/members/${u.id}`, { cookie: owner.cookie, json: { status: "active" } });
  }
  await api.call("PATCH", `/academies/${academyId}/members/${coach.id}`, { cookie: owner.cookie, json: { role: "coach" } });
});
afterAll(() => api.close());

describe("technique catalog", () => {
  it("is written by staff and read by everyone signed in", async () => {
    const base = `/academies/${academyId}/techniques`;
    expect((await api.call("POST", base, { cookie: student.cookie, json: tech("Armlock") })).status).toBe(403);
    expect((await api.call("POST", base, { cookie: outsider.cookie, json: tech("Armlock") })).status).toBe(403);

    const created = await api.call("POST", base, {
      cookie: coach.cookie,
      json: tech("Armlock", { aliases: ["chave de braço", "armbar"], position: "closed_guard", description: "Quadril alto, joelhos fechados." }),
    });
    expect(created.status).toBe(201);
    expect((await api.call("POST", base, { cookie: owner.cookie, json: tech("armlock") })).status).toBe(409);

    // An outsider finds it by an alias, and reads it without being able to edit.
    const found = await api.call("GET", "/techniques?q=chave", { cookie: outsider.cookie });
    expect(found.data.map((r: { name: string }) => r.name)).toEqual(["Armlock"]);
    const detail = await api.call("GET", `/techniques/${created.data.id}`, { cookie: outsider.cookie });
    expect(detail.data).toMatchObject({ name: "Armlock", position: "closed_guard", canEdit: false, academy: { id: academyId } });
    expect((await api.call("GET", `/techniques/${created.data.id}`, { cookie: coach.cookie })).data.canEdit).toBe(true);

    // LIKE wildcards are literal.
    expect((await api.call("GET", "/techniques?q=%25", { cookie: outsider.cookie })).data).toHaveLength(0);
    expect((await api.call("GET", "/techniques", { cookie: outsider.cookie })).status).toBe(200);
    expect((await api.call("GET", "/techniques")).status).toBe(401);

    expect((await api.call("PUT", `/techniques/${created.data.id}`, { cookie: student.cookie, json: tech("Armlock") })).status).toBe(403);
    expect((await api.call("DELETE", `/techniques/${created.data.id}`, { cookie: otherOwner.cookie })).status).toBe(403);
    expect((await api.call("PUT", `/techniques/${created.data.id}`, { cookie: owner.cookie, json: tech("Armlock da guarda", { category: "submission" }) })).status).toBe(204);
    expect((await api.call("DELETE", `/techniques/${created.data.id}`, { cookie: owner.cookie })).status).toBe(204);
    expect((await api.call("GET", `/techniques/${created.data.id}`, { cookie: owner.cookie })).status).toBe(404);
  });

  it("lets an admin add a technique to any approved academy", async () => {
    const admin = { cookie: await api.signIn("admin@example.com") };
    const created = await api.call("POST", `/academies/${otherAcademyId}/techniques`, { cookie: admin.cookie, json: tech("Mata-leão", { position: "back" }) });
    expect(created.status).toBe(201);
    const detail = await api.call("GET", `/techniques/${created.data.id}`, { cookie: otherOwner.cookie });
    expect(detail.data).toMatchObject({ name: "Mata-leão", academy: { id: otherAcademyId }, canEdit: true });
    expect((await api.call("GET", `/techniques/${created.data.id}`, { cookie: admin.cookie })).data.canEdit).toBe(true);
    expect((await api.call("POST", "/academies/nao-existe/techniques", { cookie: admin.cookie, json: tech("X1") })).status).toBe(404);
  });

  it("links techniques of the same academy into a graph", async () => {
    const base = `/academies/${academyId}/techniques`;
    const sweep = await api.call("POST", base, { cookie: coach.cookie, json: tech("Raspagem tesoura", { category: "sweep" }) });
    const mount = await api.call("POST", base, { cookie: coach.cookie, json: tech("Montada", { category: "control", leadsTo: [] }) });
    const cross = await api.call("POST", base, { cookie: coach.cookie, json: tech("Estrangulamento cruzado") });
    const foreign = await api.call("POST", `/academies/${otherAcademyId}/techniques`, { cookie: otherOwner.cookie, json: tech("Kimura") });

    // Chain: sweep → mount → cross choke. Links to another academy, or to itself, are refused.
    expect((await api.call("PUT", `/techniques/${sweep.data.id}`, { cookie: coach.cookie, json: tech("Raspagem tesoura", { category: "sweep", leadsTo: [mount.data.id, foreign.data.id] }) })).status).toBe(400);
    expect((await api.call("PUT", `/techniques/${sweep.data.id}`, { cookie: coach.cookie, json: tech("Raspagem tesoura", { category: "sweep", leadsTo: [mount.data.id, sweep.data.id] }) })).status).toBe(204);
    expect((await api.call("PUT", `/techniques/${mount.data.id}`, { cookie: coach.cookie, json: tech("Montada", { category: "control", leadsTo: [cross.data.id] }) })).status).toBe(204);

    const graph = await api.call("GET", `/techniques/graph?academy=${academyId}`, { cookie: student.cookie });
    expect(graph.data.nodes).toHaveLength(3);
    expect(graph.data.links).toEqual(expect.arrayContaining([{ from: sweep.data.id, to: mount.data.id }, { from: mount.data.id, to: cross.data.id }]));
    expect(graph.data.links).toHaveLength(2);

    const detail = await api.call("GET", `/techniques/${mount.data.id}`, { cookie: outsider.cookie });
    expect(detail.data.comesFrom.map((r: { name: string }) => r.name)).toEqual(["Raspagem tesoura"]);
    expect(detail.data.leadsTo.map((r: { name: string }) => r.name)).toEqual(["Estrangulamento cruzado"]);

    // Deleting a technique drops its links.
    await api.call("DELETE", `/techniques/${mount.data.id}`, { cookie: owner.cookie });
    expect((await api.call("GET", `/techniques/graph?academy=${academyId}`, { cookie: student.cookie })).data.links).toHaveLength(0);
  });

  it("builds each athlete's own map from what they mark and what they log", async () => {
    const base = `/academies/${academyId}/techniques`;
    const guard = await api.call("POST", base, { cookie: coach.cookie, json: tech("Guarda fechada", { category: "guard", aliases: ["Closed guard"] }) });
    const choke = await api.call("POST", base, { cookie: coach.cookie, json: tech("Ezequiel") });
    const sweep = await api.call("POST", base, { cookie: coach.cookie, json: tech("Raspagem de gancho", { category: "sweep" }) });
    await api.call("PUT", `/techniques/${guard.data.id}`, { cookie: coach.cookie, json: tech("Guarda fechada", { category: "guard", aliases: ["Closed guard"], leadsTo: [sweep.data.id] }) });
    const foreign = await api.call("POST", `/academies/${otherAcademyId}/techniques`, { cookie: otherOwner.cookie, json: tech("Ezequiel") });
    const mine = async (u: { cookie: string }) => (await api.call("GET", "/techniques/known", { cookie: u.cookie })).data as { nodes: { id: string }[]; links: unknown[] };

    expect((await mine(student)).nodes).toHaveLength(0);

    // Logged by another name, in other case: only the student's own academy's technique counts.
    await api.call("POST", "/sessions", { cookie: student.cookie, json: sessionBody({ techniques: [" closed GUARD", "ezequiel"] }) });
    const fromSessions = (await mine(student)).nodes.map((n) => n.id).sort();
    expect(fromSessions).toEqual([guard.data.id, choke.data.id].sort());
    expect(fromSessions).not.toContain(foreign.data.id);

    // Marking adds it (any academy), with the links among what they know; unmarking removes it.
    expect((await api.call("PUT", `/techniques/${sweep.data.id}/known`, { cookie: student.cookie })).status).toBe(204);
    expect((await api.call("PUT", `/techniques/${sweep.data.id}/known`, { cookie: student.cookie })).status).toBe(204);
    expect((await api.call("PUT", `/techniques/${foreign.data.id}/known`, { cookie: student.cookie })).status).toBe(204);
    const marked = await mine(student);
    expect(marked.nodes).toHaveLength(4);
    expect(marked.links).toEqual([{ from: guard.data.id, to: sweep.data.id }]);
    expect((await api.call("GET", `/techniques/${sweep.data.id}`, { cookie: student.cookie })).data.known).toBe(true);
    expect((await api.call("GET", `/techniques/${sweep.data.id}`, { cookie: coach.cookie })).data.known).toBe(false);
    const listed = async (u: { cookie: string }) =>
      ((await api.call("GET", "/techniques?q=Raspagem de gancho", { cookie: u.cookie })).data as { known: boolean }[])[0].known;
    expect(await listed(student)).toBe(true);
    expect(await listed(coach)).toBe(false);

    // Private: nobody else's map changes.
    expect((await mine(outsider)).nodes).toHaveLength(0);
    expect((await mine(coach)).nodes).toHaveLength(0);

    await api.call("DELETE", `/techniques/${foreign.data.id}/known`, { cookie: student.cookie });
    expect((await mine(student)).nodes.map((n) => n.id)).not.toContain(foreign.data.id);
    expect((await api.call("PUT", "/techniques/nao-existe/known", { cookie: student.cookie })).status).toBe(404);
  });
});
