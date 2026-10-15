import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { academyBody, sessionBody, testApi } from "./helpers";

let api: Awaited<ReturnType<typeof testApi>>;
const minorYear = new Date().getFullYear() - 15;

beforeAll(async () => {
  api = await testApi();
});
afterAll(() => api.close());

describe("auth and onboarding", () => {
  it("logs in with an e-mail code and starts without a profile", async () => {
    const cookie = await api.signIn("novo@example.com");
    const me = await api.call("GET", "/me", { cookie });
    expect(me.status).toBe(200);
    expect(me.data.user.email).toBe("novo@example.com");
    expect(me.data.profile).toBeNull();
  });

  it("rejects requests without a session", async () => {
    expect((await api.call("GET", "/me")).status).toBe(401);
    expect((await api.call("GET", "/feed")).status).toBe(401);
  });

  it("refuses users under 13", async () => {
    const cookie = await api.signIn("crianca@example.com");
    const res = await api.call("POST", "/me/profile", {
      cookie,
      json: { username: "crianca", name: "C", birthYear: new Date().getFullYear() - 10, belt: "white", stripes: 0 },
    });
    expect(res.status).toBe(400);
  });

  it("keeps usernames unique", async () => {
    await api.user("unico");
    const cookie = await api.signIn("outro-unico@example.com");
    const res = await api.call("POST", "/me/profile", {
      cookie,
      json: { username: "unico", name: "X", birthYear: 1990, belt: "white", stripes: 0 },
    });
    expect(res.status).toBe(409);
  });
});

describe("session visibility", () => {
  it("applies public / followers / private and blocks", async () => {
    const owner = await api.user("dono");
    const fan = await api.user("seguidor");
    const stranger = await api.user("estranho");

    const pub = await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ visibility: "public" }) });
    const fol = await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ visibility: "followers" }) });
    const priv = await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ visibility: "private" }) });
    expect(pub.status).toBe(201);

    expect((await api.call("POST", `/users/${owner.id}/follow`, { cookie: fan.cookie })).status).toBe(204);

    const see = async (u: { cookie: string }, id: string) => (await api.call("GET", `/sessions/${id}`, { cookie: u.cookie })).status;
    expect(await see(owner, priv.data.id)).toBe(200);
    expect(await see(fan, pub.data.id)).toBe(200);
    expect(await see(fan, fol.data.id)).toBe(200);
    expect(await see(fan, priv.data.id)).toBe(404);
    expect(await see(stranger, pub.data.id)).toBe(200);
    expect(await see(stranger, fol.data.id)).toBe(404);

    const feed = await api.call("GET", "/feed", { cookie: fan.cookie });
    expect(feed.data.items.map((s: { id: string }) => s.id).sort()).toEqual([pub.data.id, fol.data.id].sort());

    // Blocking hides even public sessions and removes the follow.
    await api.call("POST", `/users/${fan.id}/block`, { cookie: owner.cookie });
    expect(await see(fan, pub.data.id)).toBe(404);
    expect((await api.call("GET", "/feed", { cookie: fan.cookie })).data.items).toHaveLength(0);
    expect((await api.call("POST", `/users/${owner.id}/follow`, { cookie: fan.cookie })).status).toBe(403);
  });

  it("only lets the owner edit or delete", async () => {
    const a = await api.user("editora");
    const b = await api.user("intrusa");
    const s = await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ visibility: "public" }) });
    expect((await api.call("PATCH", `/sessions/${s.data.id}`, { cookie: b.cookie, json: { rpe: 2 } })).status).toBe(404);
    expect((await api.call("DELETE", `/sessions/${s.data.id}`, { cookie: b.cookie })).status).toBe(404);
    const edited = await api.call("PATCH", `/sessions/${s.data.id}`, { cookie: a.cookie, json: { rpe: 9, title: "Rolas" } });
    expect(edited.data).toMatchObject({ rpe: 9, title: "Rolas" });
    expect((await api.call("DELETE", `/sessions/${s.data.id}`, { cookie: a.cookie })).status).toBe(204);
  });
});

describe("minors", () => {
  it("never publishes publicly, is not searchable and is followable only within an academy", async () => {
    const teen = await api.user("adolescente", { birthYear: minorYear });
    const adult = await api.user("adulto");

    const s = await api.call("POST", "/sessions", { cookie: teen.cookie, json: sessionBody({ visibility: "public" }) });
    expect(s.data.visibility).toBe("followers");

    const search = await api.call("GET", "/users?q=adolesc", { cookie: adult.cookie });
    expect(search.data).toHaveLength(0);

    expect((await api.call("POST", `/users/${teen.id}/follow`, { cookie: adult.cookie })).status).toBe(403);

    // Same academy (both active) → allowed.
    const academy = { data: await api.approvedAcademy(adult.cookie, { name: "Equipe Teste" }) };
    await api.call("POST", `/academies/${academy.data.id}/join`, { cookie: teen.cookie });
    await api.call("PATCH", `/academies/${academy.data.id}/members/${teen.id}`, { cookie: adult.cookie, json: { status: "active" } });
    expect((await api.call("POST", `/users/${teen.id}/follow`, { cookie: adult.cookie })).status).toBe(204);
  });
});

describe("social", () => {
  it("notifies on oss, comment and follow", async () => {
    const a = await api.user("ana");
    const b = await api.user("bruno");
    const s = await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ visibility: "public" }) });
    await api.call("POST", `/users/${a.id}/follow`, { cookie: b.cookie });
    await api.call("POST", `/sessions/${s.data.id}/oss`, { cookie: b.cookie });
    await api.call("POST", `/sessions/${s.data.id}/oss`, { cookie: b.cookie }); // idempotent
    await api.call("POST", `/sessions/${s.data.id}/comments`, { cookie: b.cookie, json: { body: "Oss!" } });

    const detail = await api.call("GET", `/sessions/${s.data.id}`, { cookie: a.cookie });
    expect(detail.data).toMatchObject({ ossCount: 1, commentCount: 1 });
    expect(detail.data.comments[0].body).toBe("Oss!");

    const notes = await api.call("GET", "/me/notifications", { cookie: a.cookie });
    expect(notes.data.map((n: { type: string }) => n.type).sort()).toEqual(["comment", "follow", "oss"]);
    expect((await api.call("GET", "/me", { cookie: a.cookie })).data.unreadNotifications).toBe(3);
    await api.call("POST", "/me/notifications/read", { cookie: a.cookie });
    expect((await api.call("GET", "/me", { cookie: a.cookie })).data.unreadNotifications).toBe(0);
  });

  it("lets the session owner delete others' comments", async () => {
    const a = await api.user("carla");
    const b = await api.user("diego");
    const s = await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ visibility: "public" }) });
    const c = await api.call("POST", `/sessions/${s.data.id}/comments`, { cookie: b.cookie, json: { body: "spam" } });
    expect((await api.call("DELETE", `/comments/${c.data.id}`, { cookie: a.cookie })).status).toBe(204);
  });

  it("accepts reports", async () => {
    const a = await api.user("relatora");
    const res = await api.call("POST", "/reports", { cookie: a.cookie, json: { targetType: "user", targetId: "x", reason: "perfil falso" } });
    expect(res.status).toBe(201);
  });
});

describe("academies", () => {
  it("handles join requests, roles, members and ranking", async () => {
    const owner = await api.user("mestre");
    const coach = await api.user("professor");
    const student = await api.user("aluno");

    const a = { data: await api.approvedAcademy(owner.cookie) };
    expect(a.data).toMatchObject({ slug: "tatame-centro", country: "PT" });
    const id = a.data.id;

    await api.call("POST", `/academies/${id}/join`, { cookie: coach.cookie });
    await api.call("POST", `/academies/${id}/join`, { cookie: student.cookie });

    // Pending members cannot see the member list; staff see pending requests.
    expect((await api.call("GET", `/academies/${id}/members`, { cookie: student.cookie })).status).toBe(403);
    const pending = await api.call("GET", `/academies/${id}/members`, { cookie: owner.cookie });
    expect(pending.data.filter((m: { status: string }) => m.status === "pending")).toHaveLength(2);

    await api.call("PATCH", `/academies/${id}/members/${coach.id}`, { cookie: owner.cookie, json: { status: "active", role: "coach" } });
    // A coach approves students but cannot grant roles.
    expect((await api.call("PATCH", `/academies/${id}/members/${student.id}`, { cookie: coach.cookie, json: { role: "coach" } })).status).toBe(403);
    expect((await api.call("PATCH", `/academies/${id}/members/${student.id}`, { cookie: coach.cookie, json: { status: "active" } })).status).toBe(204);

    // Approval sets the home academy, so new sessions default to it.
    const s = await api.call("POST", "/sessions", { cookie: student.cookie, json: sessionBody() });
    expect(s.data.academy?.id).toBe(id);

    const ranking = await api.call("GET", `/academies/${id}/ranking`, { cookie: student.cookie });
    expect(ranking.data[0]).toMatchObject({ username: "aluno", sessions: 1, rank: 1 });

    const feed = await api.call("GET", "/feed?scope=academy", { cookie: coach.cookie });
    expect(feed.status).toBe(200);

    // Nobody removes the owner; a student can leave.
    expect((await api.call("DELETE", `/academies/${id}/members/${owner.id}`, { cookie: coach.cookie })).status).toBe(403);
    expect((await api.call("DELETE", `/academies/${id}/members/${student.id}`, { cookie: student.cookie })).status).toBe(204);
  });

  it("rejects sessions tagged with an academy the user is not in", async () => {
    const owner = await api.user("dona2");
    const other = await api.user("fora");
    const a = { data: await api.approvedAcademy(owner.cookie, { name: "Outra Equipe" }) };
    const res = await api.call("POST", "/sessions", { cookie: other.cookie, json: sessionBody({ academyId: a.data.id }) });
    expect(res.status).toBe(400);
  });
});

describe("academy verification", () => {
  it("keeps a new academy hidden until an admin approves it", async () => {
    const owner = await api.user("donaverif");
    const student = await api.user("alunoverif");
    const adm = await api.user("admin").catch(() => null);
    const adminCookie = adm?.cookie ?? (await api.signIn("admin@example.com"));

    // Incomplete registrations are refused.
    expect((await api.call("POST", "/academies", { cookie: owner.cookie, json: { name: "Só Nome" } })).status).toBe(400);
    expect((await api.call("POST", "/academies", { cookie: owner.cookie, json: academyBody({ instagram: "", name: "Sem Canal" }) })).status).toBe(400);

    const a = await api.call("POST", "/academies", { cookie: owner.cookie, json: academyBody({ name: "Academia Verificada" }) });
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ status: "pending", instagram: "tatamecentro", country: "PT" });
    const id = a.data.id;

    // One open registration per person.
    expect((await api.call("POST", "/academies", { cookie: owner.cookie, json: academyBody({ name: "Segunda" }) })).status).toBe(409);

    // Hidden from search and from other users, closed to members and to session tagging.
    const search = await api.call("GET", "/academies?q=Verificada", { cookie: student.cookie });
    expect(search.data).toHaveLength(0);
    expect((await api.call("GET", `/academies/${id}`, { cookie: student.cookie })).status).toBe(404);
    expect((await api.call("POST", `/academies/${id}/join`, { cookie: student.cookie })).status).toBe(404);
    expect((await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ academyId: id }) })).status).toBe(400);

    // The owner follows the review.
    const own = await api.call("GET", `/academies/${id}`, { cookie: owner.cookie });
    expect(own.data).toMatchObject({ status: "pending", membership: { role: "owner" }, registration: { requesterRole: "owner" } });

    // Only admins reach the panel.
    expect((await api.call("GET", "/admin/academies", { cookie: owner.cookie })).status).toBe(403);
    expect((await api.call("GET", "/me", { cookie: owner.cookie })).data.admin).toBeNull();
    const me = await api.call("GET", "/me", { cookie: adminCookie });
    expect(me.data.admin.pendingAcademies).toBeGreaterThanOrEqual(1);
    const notes = await api.call("GET", "/me/notifications", { cookie: adminCookie });
    expect(notes.data.some((n: { type: string; targetId: string }) => n.type === "academy_submitted" && n.targetId === id)).toBe(true);

    const queue = await api.call("GET", "/admin/academies?status=pending", { cookie: adminCookie });
    expect(queue.data.map((q: { id: string }) => q.id)).toContain(id);
    const detail = await api.call("GET", `/admin/academies/${id}`, { cookie: adminCookie });
    expect(detail.data).toMatchObject({ phone: "+351 210 000 000", requester: { email: "donaverif@example.com" } });
    // "Tatame Centro" (earlier test) uses the same Instagram handle, so it shows up as a possible duplicate.
    expect(detail.data.similar).toContainEqual(expect.objectContaining({ name: "Tatame Centro" }));

    // Rejection needs a reason; the owner corrects and resubmits.
    expect((await api.call("POST", `/admin/academies/${id}/review`, { cookie: adminCookie, json: { decision: "reject" } })).status).toBe(400);
    expect((await api.call("POST", `/admin/academies/${id}/review`, { cookie: adminCookie, json: { decision: "reject", note: "O Instagram não mostra você." } })).status).toBe(204);
    const rejected = await api.call("GET", `/academies/${id}`, { cookie: owner.cookie });
    expect(rejected.data).toMatchObject({ status: "rejected", registration: { reviewNote: "O Instagram não mostra você." } });
    const ownerNotes = await api.call("GET", "/me/notifications", { cookie: owner.cookie });
    expect(ownerNotes.data[0].type).toBe("academy_rejected");

    expect((await api.call("PUT", `/academies/${id}`, { cookie: student.cookie, json: academyBody() })).status).toBe(404);
    const resent = await api.call("PUT", `/academies/${id}`, { cookie: owner.cookie, json: academyBody({ name: "Academia Verificada", website: "https://verificada.pt" }) });
    expect(resent.data).toMatchObject({ status: "pending", reviewNote: null });

    expect((await api.call("POST", `/admin/academies/${id}/review`, { cookie: adminCookie, json: { decision: "approve" } })).status).toBe(204);
    expect((await api.call("POST", `/admin/academies/${id}/review`, { cookie: adminCookie, json: { decision: "reject", note: "de novo" } })).status).toBe(409);

    // Approved: searchable, joinable, and the owner's home academy.
    expect((await api.call("GET", "/academies?q=Verificada", { cookie: student.cookie })).data).toHaveLength(1);
    expect((await api.call("POST", `/academies/${id}/join`, { cookie: student.cookie })).status).toBe(204);
    expect((await api.call("GET", "/me", { cookie: owner.cookie })).data.profile.homeAcademyId).toBe(id);
    expect((await api.call("PUT", `/academies/${id}`, { cookie: owner.cookie, json: academyBody() })).status).toBe(409);
  });
});

describe("timetable and roll call", () => {
  it("shows classes to everyone and lets only staff take attendance", async () => {
    const owner = await api.user("mestrechamada");
    const student = await api.user("alunochamada");
    const outsider = await api.user("forachamada");
    const a = await api.approvedAcademy(owner.cookie, { name: "Academia Chamada", instagram: "chamada" });
    await api.call("POST", `/academies/${a.id}/join`, { cookie: student.cookie });
    await api.call("PATCH", `/academies/${a.id}/members/${student.id}`, { cookie: owner.cookie, json: { status: "active" } });

    const gi = { weekday: 1, startTime: "19:00", durationMin: 90, title: "Gi todos os níveis", kind: "gi" };
    expect((await api.call("POST", `/academies/${a.id}/classes`, { cookie: student.cookie, json: gi })).status).toBe(403);
    expect((await api.call("POST", `/academies/${a.id}/classes`, { cookie: owner.cookie, json: { ...gi, startTime: "25:00" } })).status).toBe(400);
    const k = await api.call("POST", `/academies/${a.id}/classes`, { cookie: owner.cookie, json: gi });
    expect(k.status).toBe(201);
    await api.call("POST", `/academies/${a.id}/classes`, { cookie: owner.cookie, json: { ...gi, weekday: 6, startTime: "10:00", title: "Open mat", kind: "open_mat" } });

    // The timetable is public, like the address.
    const list = await api.call("GET", `/academies/${a.id}/classes`, { cookie: outsider.cookie });
    expect(list.data.map((x: { title: string }) => x.title)).toEqual(["Gi todos os níveis", "Open mat"]);

    // Last Monday (or today, if it is Monday).
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const monday = d.toISOString().slice(0, 10);
    const tuesday = new Date(d.getTime() + 86_400_000).toISOString().slice(0, 10);
    const path = `/academies/${a.id}/classes/${k.data.id}/attendance`;

    // The student logs the class themselves; the professor has not taken the roll yet.
    await api.call("POST", "/sessions", { cookie: student.cookie, json: sessionBody({ academyId: a.id, startedAt: `${monday}T19:10:00Z` }) });
    // A session at another time that day is not this class.
    await api.call("POST", "/sessions", { cookie: owner.cookie, json: sessionBody({ academyId: a.id, startedAt: `${monday}T07:00:00Z` }) });

    expect((await api.call("GET", `${path}?date=${monday}&tz=UTC`, { cookie: student.cookie })).status).toBe(403);
    const sheet = await api.call("GET", `${path}?date=${monday}&tz=UTC`, { cookie: owner.cookie });
    expect(sheet.data.members.map((m: { username: string; present: boolean; logged: boolean }) => [m.username, m.present, m.logged])).toEqual([
      ["alunochamada", false, true],
      ["mestrechamada", false, false],
    ]);
    const pending = await api.call("GET", `/academies/${a.id}/attendance/pending?tz=UTC`, { cookie: owner.cookie });
    expect(pending.data).toEqual([expect.objectContaining({ date: monday, logged: 1, class: expect.objectContaining({ id: k.data.id }) })]);
    expect((await api.call("GET", `/academies/${a.id}/attendance/pending?tz=UTC`, { cookie: student.cookie })).status).toBe(403);

    expect((await api.call("PUT", path, { cookie: owner.cookie, json: { date: tuesday, userIds: [student.id] } })).status).toBe(400);
    expect((await api.call("PUT", path, { cookie: owner.cookie, json: { date: monday, userIds: [outsider.id] } })).status).toBe(400);
    expect((await api.call("PUT", path, { cookie: student.cookie, json: { date: monday, userIds: [student.id] } })).status).toBe(403);
    const saved = await api.call("PUT", path, { cookie: owner.cookie, json: { date: monday, userIds: [student.id, owner.id] } });
    expect(saved.data).toEqual({ present: 2 });
    expect((await api.call("GET", `/academies/${a.id}/attendance/pending?tz=UTC`, { cookie: owner.cookie })).data).toEqual([]);

    // The student is nudged to log the session, once, and can load the class to prefill it.
    const notes = await api.call("GET", "/me/notifications", { cookie: student.cookie });
    expect(notes.data[0]).toMatchObject({ type: "attendance_confirmed", targetId: `${k.data.id}/${monday}` });
    await api.call("PUT", path, { cookie: owner.cookie, json: { date: monday, userIds: [student.id] } });
    const again = await api.call("GET", "/me/notifications", { cookie: student.cookie });
    expect(again.data.filter((n: { type: string }) => n.type === "attendance_confirmed")).toHaveLength(1);
    expect((await api.call("GET", `/classes/${k.data.id}`, { cookie: student.cookie })).data).toMatchObject({ title: "Gi todos os níveis", durationMin: 90 });

    const marked = await api.call("GET", `${path}?date=${monday}&tz=UTC`, { cookie: owner.cookie });
    expect(marked.data.members.filter((m: { present: boolean }) => m.present)).toHaveLength(1);

    // Staff see attendance counts in the member list; students do not.
    const staffView = await api.call("GET", `/academies/${a.id}/members`, { cookie: owner.cookie });
    expect(staffView.data.find((m: { id: string }) => m.id === student.id).attendance30d).toBe(1);
    const studentView = await api.call("GET", `/academies/${a.id}/members`, { cookie: student.cookie });
    expect(studentView.data[0].attendance30d).toBeUndefined();

    // Archiving hides the class but keeps the history.
    expect((await api.call("DELETE", `/academies/${a.id}/classes/${k.data.id}`, { cookie: owner.cookie })).status).toBe(204);
    expect((await api.call("GET", `/academies/${a.id}/classes`, { cookie: owner.cookie })).data).toHaveLength(1);
    const after = await api.call("GET", `/academies/${a.id}/members`, { cookie: owner.cookie });
    expect(after.data.find((m: { id: string }) => m.id === student.id).attendance30d).toBe(1);
  });
});

describe("promotions", () => {
  it("are confirmed only by academy staff, never by oneself", async () => {
    const owner = await api.user("faixapreta", { belt: "black" });
    const student = await api.user("graduando");
    const a = { data: await api.approvedAcademy(owner.cookie, { name: "Equipe Graduação" }) };
    await api.call("POST", `/academies/${a.data.id}/join`, { cookie: student.cookie });
    await api.call("PATCH", `/academies/${a.data.id}/members/${student.id}`, { cookie: owner.cookie, json: { status: "active" } });

    const p = await api.call("POST", "/promotions", {
      cookie: student.cookie,
      json: { belt: "blue", stripes: 0, promotedOn: "2026-10-01", academyId: a.data.id },
    });
    expect(p.status).toBe(201);
    expect((await api.call("GET", "/me", { cookie: student.cookie })).data.profile.belt).toBe("blue");

    expect((await api.call("POST", `/promotions/${p.data.id}/confirm`, { cookie: student.cookie })).status).toBe(403);
    expect((await api.call("GET", "/promotions/pending", { cookie: owner.cookie })).data).toHaveLength(1);
    expect((await api.call("POST", `/promotions/${p.data.id}/confirm`, { cookie: owner.cookie })).status).toBe(204);

    const profile = await api.call("GET", "/users/graduando", { cookie: owner.cookie });
    expect(profile.data.promotions[0].confirmedBy).toBe(owner.id);
  });
});

describe("account", () => {
  it("exports data and deletes everything", async () => {
    const a = await api.user("saindo");
    const b = await api.user("ficando");
    const s = await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ visibility: "public" }) });
    await api.call("POST", `/sessions/${s.data.id}/comments`, { cookie: a.cookie, json: { body: "meu" } });

    const exp = await api.call("GET", "/me/export", { cookie: a.cookie });
    expect(exp.data.sessions).toHaveLength(1);
    expect(exp.data.comments).toHaveLength(1);

    expect((await api.call("DELETE", "/me", { cookie: a.cookie })).status).toBe(204);
    expect((await api.call("GET", `/sessions/${s.data.id}`, { cookie: b.cookie })).status).toBe(404);
    expect((await api.call("GET", "/me", { cookie: a.cookie })).status).toBe(401);
  });

  it("changes the visibility of all past sessions", async () => {
    const a = await api.user("privada");
    await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ visibility: "public" }) });
    const res = await api.call("POST", "/me/sessions/visibility", { cookie: a.cookie, json: { visibility: "private" } });
    expect(res.data.updated).toBe(1);
    const feed = await api.call("GET", "/feed?scope=me", { cookie: a.cookie });
    expect(feed.data.items[0].visibility).toBe("private");
  });

  it("returns stats for the current week", async () => {
    const a = await api.user("estatistica", { weeklyGoal: 1 });
    await api.call("POST", "/sessions", { cookie: a.cookie, json: sessionBody({ durationMin: 60, rpe: 5, kind: "nogi" }) });
    const stats = await api.call("GET", "/me/stats?tz=Europe/Lisbon", { cookie: a.cookie });
    expect(stats.data.totals).toEqual({ sessions: 1, minutes: 60, rounds: 6 });
    expect(stats.data.thisWeek.sessions).toBe(1);
    expect(stats.data.streakWeeks).toBe(1);
    expect((await api.call("GET", "/me/stats?tz=Mars/Base", { cookie: a.cookie })).status).toBe(400);
  });
});

describe("login codes", () => {
  it("rejects a wrong code", async () => {
    await api.call("POST", "/auth/email-otp/send-verification-otp", { json: { email: "errado@example.com", type: "sign-in" } });
    const res = await api.call("POST", "/auth/sign-in/email-otp", { json: { email: "errado@example.com", otp: "000000" } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
