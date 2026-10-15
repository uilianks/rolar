// Demo data for local testing: an approved academy run by a professor, with a coach, ~20 students,
// three months of training, follows, Oss, comments, a weekly timetable with four weeks of roll calls
// (topics, a holiday), events and competitions with medals, notices, fees (some late), two students who
// stopped coming, pending join requests and pending graduations.
// Re-running replaces the previous demo data (users "demo.*@example.com", academies "demo-*").
//   npm run db:seed                 (uses DATABASE_URL, like the API)
import { and, eq, like } from "drizzle-orm";

import { type Belt, type SessionKind, isMinor } from "../../src/shared/domain";
import { pt } from "../../src/shared/i18n/pt";
import { loadEnv } from "../env";
import { createDb } from "./client";
import * as s from "./schema";

const env = loadEnv();
if (env.NODE_ENV === "production" || /neon\.tech/.test(env.DATABASE_URL)) {
  throw new Error("O seed é só para bancos locais");
}

const email = (handle: string) => `demo.${handle}@example.com`;

type Person = { handle: string; name: string; belt: Belt; stripes: number; birthYear: number; perWeek: number };

const PROFESSOR: Person = { handle: "professor", name: "Carlos Mendes", belt: "black", stripes: 2, birthYear: 1979, perWeek: 5 };
const COACH: Person = { handle: "coach", name: "Joana Ribeiro", belt: "brown", stripes: 3, birthYear: 1990, perWeek: 4 };
const STUDENTS: Person[] = [
  { handle: "miguel", name: "Miguel Costa", belt: "purple", stripes: 2, birthYear: 1992, perWeek: 4 },
  { handle: "ines", name: "Inês Ferreira", belt: "blue", stripes: 4, birthYear: 1996, perWeek: 4 },
  { handle: "tiago", name: "Tiago Almeida", belt: "blue", stripes: 1, birthYear: 1988, perWeek: 3 },
  { handle: "beatriz", name: "Beatriz Santos", belt: "white", stripes: 4, birthYear: 2000, perWeek: 3 },
  { handle: "rui", name: "Rui Carvalho", belt: "white", stripes: 2, birthYear: 1985, perWeek: 2 },
  { handle: "sofia", name: "Sofia Pereira", belt: "purple", stripes: 0, birthYear: 1993, perWeek: 3 },
  { handle: "andre", name: "André Rodrigues", belt: "blue", stripes: 2, birthYear: 1998, perWeek: 5 },
  { handle: "mariana", name: "Mariana Gomes", belt: "white", stripes: 1, birthYear: 2002, perWeek: 2 },
  { handle: "pedro", name: "Pedro Martins", belt: "brown", stripes: 1, birthYear: 1987, perWeek: 3 },
  { handle: "catarina", name: "Catarina Lopes", belt: "white", stripes: 0, birthYear: 1999, perWeek: 1 },
  { handle: "joao", name: "João Sousa", belt: "blue", stripes: 3, birthYear: 1994, perWeek: 3 },
  { handle: "ana", name: "Ana Oliveira", belt: "white", stripes: 3, birthYear: 1997, perWeek: 4 },
  { handle: "diogo", name: "Diogo Fernandes", belt: "purple", stripes: 3, birthYear: 1991, perWeek: 2 },
  { handle: "rita", name: "Rita Marques", belt: "blue", stripes: 0, birthYear: 2001, perWeek: 2 },
  { handle: "nuno", name: "Nuno Silva", belt: "white", stripes: 0, birthYear: 1983, perWeek: 1 },
  { handle: "lucas", name: "Lucas Teixeira", belt: "white", stripes: 1, birthYear: new Date().getFullYear() - 16, perWeek: 3 },
  { handle: "marta", name: "Marta Correia", belt: "white", stripes: 2, birthYear: new Date().getFullYear() - 15, perWeek: 2 },
];
/** Asked to join; waiting for the professor. */
const APPLICANTS: Person[] = [
  { handle: "henrique", name: "Henrique Pinto", belt: "white", stripes: 0, birthYear: 1995, perWeek: 2 },
  { handle: "leonor", name: "Leonor Cardoso", belt: "blue", stripes: 1, birthYear: 1998, perWeek: 3 },
  { handle: "gustavo", name: "Gustavo Moreira", belt: "purple", stripes: 1, birthYear: 1986, perWeek: 3 },
  { handle: "clara", name: "Clara Nunes", belt: "white", stripes: 0, birthYear: new Date().getFullYear() - 14, perWeek: 1 },
];
/** Students asking the professor to confirm a new belt or stripe. */
/** Stopped coming three weeks ago: they show up in "Alunos sumidos". */
const MISSING = new Set(["catarina", "nuno"]);
const TOPICS = ["Raspagem de gancho", "Passagem toreando", "Defesa de mata-leão", "Triângulo da guarda fechada", "Saída de montada", "Leglocks: ashi garami", "Pegadas de lapela", "Kimura da meia-guarda"];
/** Students' fee situation this month (everyone else is up to date). */
const LATE = new Set(["rui", "joao", "rita"]);
const DUE = new Set(["mariana", "ana"]);
const SCHOLARSHIP = new Set(["lucas", "marta"]);

const GRADUATION_REQUESTS: { handle: string; belt: Belt; stripes: number; daysAgo: number }[] = [
  { handle: "beatriz", belt: "blue", stripes: 0, daysAgo: 2 },
  { handle: "ines", belt: "purple", stripes: 0, daysAgo: 5 },
  { handle: "andre", belt: "blue", stripes: 3, daysAgo: 1 },
];

const KINDS: SessionKind[] = ["gi", "gi", "gi", "nogi", "nogi", "open_mat", "drill", "competition"];
const TITLES: Record<SessionKind, string[]> = {
  gi: ["Aula de gi", "Gi da noite", "Treino de lapela", "Guarda aranha", "Passagens de guarda"],
  nogi: ["No-gi da manhã", "Leglocks", "Wrestling para BJJ", "Front headlock"],
  open_mat: ["Open mat de sábado", "Open mat"],
  drill: ["Drills de raspagem", "Repetição de passagens"],
  private: ["Aula particular"],
  competition: ["Treino de competição", "Simulação de luta"],
  teaching: ["Aula para iniciantes", "Aula kids"],
};
const TECHNIQUES = [
  "Armlock da guarda", "Triângulo", "Kimura", "Mata-leão", "Raspagem de gancho", "Passagem toreando",
  "Berimbolo", "Heel hook", "Single leg", "Double leg", "Guilhotina", "Omoplata", "Raspagem tesoura",
  "Saída de montada", "Knee slice", "De la Riva", "Estrangulamento cruzado", "Ezequiel",
];
const NOTES = [
  "Muito cansado no último round, preciso de cardio.",
  "Finalmente encaixei o triângulo no rola.",
  "Treino técnico, foco em detalhes de pegada.",
  "Rolei com faixas mais graduadas, apanhei bastante mas aprendi.",
  "Joelho um pouco dorido, peguei leve.",
  null,
  null,
];
const COMMENTS = ["Oss! Bom treino 👊", "Boa! Esse triângulo está cada vez melhor.", "Amanhã tem mais.", "Excelente ritmo hoje.", "Cuidado com esse joelho!", "Bora pro open mat?"];

// Deterministic pseudo-random numbers, so every run looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

async function main() {
  const handle = await createDb(env.DATABASE_URL);
  await handle.migrate();
  const db = handle.db;

  // Remove previous demo data (cascades to profiles, sessions, follows, notifications…).
  await db.delete(s.academies).where(like(s.academies.slug, "demo-%"));
  await db.delete(s.user).where(like(s.user.email, "demo.%@example.com"));

  const everyone = [PROFESSOR, COACH, ...STUDENTS, ...APPLICANTS];
  const ids = new Map<string, string>();
  for (const p of everyone) ids.set(p.handle, crypto.randomUUID());
  const id = (h: string) => ids.get(h)!;
  const now = Date.now();
  const daysAgo = (d: number, hour = 19) => {
    const t = new Date(now - d * 86_400_000);
    t.setHours(hour, between(0, 3) * 15, 0, 0);
    // Nothing in the future: today's late sessions move to earlier today.
    return t.getTime() > now ? new Date(now - between(1, 3) * 3_600_000) : t;
  };

  await db.insert(s.user).values(
    everyone.map((p) => ({ id: id(p.handle), name: p.name, email: email(p.handle), emailVerified: true, createdAt: daysAgo(between(100, 400)) })),
  );

  const [academy] = await db
    .insert(s.academies)
    .values({
      name: "Demo BJJ Lisboa",
      slug: "demo-bjj-lisboa",
      affiliation: "Independente",
      address: "Avenida da Liberdade 100",
      postalCode: "1250-096",
      city: "Lisboa",
      country: "PT",
      phone: "+351 210 000 000",
      email: "contacto@demobjj.example.com",
      website: "https://demobjj.example.com",
      instagram: "demobjj",
      createdBy: id(PROFESSOR.handle),
      status: "approved",
      requesterRole: "owner",
      proof: "Academia de demonstração criada pelo seed.",
      submittedAt: daysAgo(120),
      reviewedAt: daysAgo(119),
    })
    .returning();

  await db.insert(s.profiles).values(
    everyone.map((p) => ({
      userId: id(p.handle),
      username: `demo_${p.handle}`,
      name: p.name,
      birthYear: p.birthYear,
      belt: p.belt,
      stripes: p.stripes,
      startedAt: `${2025 - Math.max(1, ["white", "blue", "purple", "brown", "black"].indexOf(p.belt) * 2)}-0${between(1, 9)}`,
      homeAcademyId: APPLICANTS.includes(p) ? null : academy.id,
      weeklyGoal: Math.min(5, p.perWeek + 1),
      defaultVisibility: isMinor(p.birthYear) ? ("followers" as const) : pick(["followers", "followers", "public"] as const),
      searchable: !isMinor(p.birthYear),
    })),
  );

  await db.insert(s.academyMembers).values([
    { academyId: academy.id, userId: id(PROFESSOR.handle), role: "owner", status: "active", createdAt: daysAgo(119) },
    { academyId: academy.id, userId: id(COACH.handle), role: "coach", status: "active", createdAt: daysAgo(110) },
    ...STUDENTS.map((p) => ({ academyId: academy.id, userId: id(p.handle), role: "student" as const, status: "active" as const, createdAt: daysAgo(between(20, 110)) })),
    ...APPLICANTS.map((p, i) => ({ academyId: academy.id, userId: id(p.handle), role: "student" as const, status: "pending" as const, createdAt: daysAgo(i) })),
  ]);

  // Weekly timetable (ISO weekdays) and roll calls for the past four weeks.
  const timetable = [
    ...[1, 3, 5].map((weekday) => ({ weekday, startTime: "07:00", durationMin: 60, title: "No-gi da manhã", kind: "nogi" as const })),
    ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "19:00", durationMin: 90, title: "Gi todos os níveis", kind: "gi" as const })),
    ...[2, 4].map((weekday) => ({ weekday, startTime: "20:45", durationMin: 75, title: "Competição", kind: "competition" as const })),
    { weekday: 3, startTime: "18:00", durationMin: 60, title: "Iniciantes", kind: "gi" as const },
    { weekday: 6, startTime: "10:00", durationMin: 120, title: "Open mat", kind: "open_mat" as const },
  ];
  const classes = await db
    .insert(s.academyClasses)
    .values(timetable.map((k) => ({ ...k, academyId: academy.id, createdAt: daysAgo(100) })))
    .returning();
  const attendance: (typeof s.attendance.$inferInsert)[] = [];
  const attendees = [COACH, ...STUDENTS];
  for (let ago = 1; ago <= 28; ago++) {
    if (ago === 2) continue; // the professor "forgot" these: they show up as roll calls to do
    const day = daysAgo(ago, 12);
    const weekday = ((day.getDay() + 6) % 7) + 1;
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    for (const k of classes.filter((x) => x.weekday === weekday)) {
      const marked = [PROFESSOR, ...attendees.filter((p) => !(MISSING.has(p.handle) && ago < 21) && rand() < p.perWeek / 8)];
      for (const p of marked) attendance.push({ classId: k.id, date, userId: id(p.handle), markedBy: id(PROFESSOR.handle), createdAt: day });
    }
  }
  for (let i = 0; i < attendance.length; i += 200) await db.insert(s.attendance).values(attendance.slice(i, i + 200));

  // Topics for the roll calls taken, and last Monday's evening class cancelled for a holiday.
  const taken = [...new Set(attendance.map((x) => `${x.classId}|${x.date}`))];
  await db.insert(s.classOccurrences).values(
    taken.map((key) => {
      const [classId, date] = key.split("|");
      return { classId, date, topic: pick(TOPICS), updatedBy: id(PROFESSOR.handle) };
    }),
  );
  const holiday = daysAgo(((new Date(now).getDay() + 6) % 7) + 7, 12); // Monday of last week
  const holidayDate = `${holiday.getFullYear()}-${String(holiday.getMonth() + 1).padStart(2, "0")}-${String(holiday.getDate()).padStart(2, "0")}`;
  const eveningMonday = classes.find((k) => k.weekday === 1 && k.startTime === "19:00")!;
  await db.delete(s.attendance).where(and(eq(s.attendance.classId, eveningMonday.id), eq(s.attendance.date, holidayDate)));
  await db
    .insert(s.classOccurrences)
    .values({ classId: eveningMonday.id, date: holidayDate, cancelled: true, note: "Feriado", updatedBy: id(PROFESSOR.handle) })
    .onConflictDoUpdate({ target: [s.classOccurrences.classId, s.classOccurrences.date], set: { cancelled: true, note: "Feriado", topic: null } });

  // Training: ~13 weeks per person, at their usual frequency, with a lighter week now and then.
  const sessions: (typeof s.sessions.$inferInsert)[] = [];
  for (const p of [PROFESSOR, COACH, ...STUDENTS]) {
    const minor = isMinor(p.birthYear);
    for (let week = 0; week < 13; week++) {
      const count = Math.max(0, p.perWeek - (rand() < 0.25 ? between(1, 2) : 0));
      const days = new Set<number>();
      while (days.size < Math.min(count, 6)) days.add(between(0, 6));
      for (const d of days) {
        const ago = week * 7 + d;
        if (ago === 0 && rand() < 0.5) continue;
        if (MISSING.has(p.handle) && ago < 21) continue;
        const kind = p === PROFESSOR && rand() < 0.4 ? "teaching" : pick(KINDS);
        const visibility = minor ? "followers" : pick(["followers", "followers", "public", "private"] as const);
        sessions.push({
          id: crypto.randomUUID(),
          userId: id(p.handle),
          academyId: academy.id,
          kind,
          startedAt: daysAgo(ago, pick([7, 12, 19, 20])),
          durationMin: pick([60, 75, 90, 90, 120]),
          rounds: kind === "drill" || kind === "teaching" ? 0 : between(3, 8),
          rpe: between(4, 9),
          title: pick(TITLES[kind]),
          notes: pick(NOTES),
          techniques: Array.from({ length: between(0, 3) }, () => pick(TECHNIQUES)).filter((t, i, a) => a.indexOf(t) === i),
          visibility,
          source: rand() < 0.3 ? "timer" : "manual",
        });
      }
    }
  }
  for (let i = 0; i < sessions.length; i += 200) await db.insert(s.sessions).values(sessions.slice(i, i + 200));

  // Everyone follows the professor and the coach; the professor follows the adults; some students follow each other.
  const members = [PROFESSOR, COACH, ...STUDENTS];
  const follows = new Map<string, { followerId: string; followeeId: string }>();
  const follow = (a: Person, b: Person) => a !== b && follows.set(`${a.handle}>${b.handle}`, { followerId: id(a.handle), followeeId: id(b.handle) });
  for (const p of members) {
    follow(p, PROFESSOR);
    follow(p, COACH);
    if (!isMinor(p.birthYear)) follow(PROFESSOR, p);
    for (let i = 0; i < 4; i++) follow(p, pick(members));
  }
  await db.insert(s.follows).values([...follows.values()]);

  // Oss and comments on recent sessions, and the notifications they produce.
  const recent = sessions.filter((x) => x.startedAt! > daysAgo(14));
  const reactions = new Map<string, { sessionId: string; userId: string; createdAt: Date }>();
  const comments: (typeof s.comments.$inferInsert)[] = [];
  const notifications: (typeof s.notifications.$inferInsert)[] = [];
  for (const x of recent) {
    for (let i = 0; i < between(0, 5); i++) {
      const by = pick(members);
      if (id(by.handle) === x.userId) continue;
      reactions.set(`${x.id}:${by.handle}`, { sessionId: x.id!, userId: id(by.handle), createdAt: x.startedAt! });
      notifications.push({ userId: x.userId, actorId: id(by.handle), type: "oss", targetId: x.id, createdAt: x.startedAt!, readAt: rand() < 0.6 ? new Date() : null });
    }
    if (rand() < 0.25) {
      const by = pick(members);
      if (id(by.handle) === x.userId) continue;
      comments.push({ sessionId: x.id!, userId: id(by.handle), body: pick(COMMENTS), createdAt: x.startedAt! });
      notifications.push({ userId: x.userId, actorId: id(by.handle), type: "comment", targetId: x.id, createdAt: x.startedAt!, readAt: rand() < 0.5 ? new Date() : null });
    }
  }
  await db.insert(s.reactions).values([...reactions.values()]);
  if (comments.length) await db.insert(s.comments).values(comments);

  // Graduation history (confirmed by the professor) and requests waiting for confirmation.
  await db.insert(s.promotions).values([
    ...STUDENTS.filter((p) => p.belt !== "white").map((p) => ({
      userId: id(p.handle),
      belt: p.belt,
      stripes: 0,
      promotedOn: daysAgo(between(120, 600)).toISOString().slice(0, 10),
      academyId: academy.id,
      confirmedBy: id(PROFESSOR.handle),
      confirmedAt: daysAgo(between(100, 119)),
    })),
    ...GRADUATION_REQUESTS.map((g) => ({
      userId: id(g.handle),
      belt: g.belt,
      stripes: g.stripes,
      promotedOn: daysAgo(g.daysAgo).toISOString().slice(0, 10),
      academyId: academy.id,
      createdAt: daysAgo(g.daysAgo),
    })),
  ]);

  // The professor's pending work shows up in their notifications too (the coach sees the same requests).
  for (const staff of [PROFESSOR, COACH]) {
    for (const [i, p] of APPLICANTS.entries()) {
      notifications.push({ userId: id(staff.handle), actorId: id(p.handle), type: "membership_request", targetId: academy.id, createdAt: daysAgo(i, 10) });
    }
    for (const g of GRADUATION_REQUESTS) {
      notifications.push({ userId: id(staff.handle), actorId: id(g.handle), type: "promotion_request", targetId: academy.id, createdAt: daysAgo(g.daysAgo, 11) });
    }
  }
  // Notice board.
  await db.insert(s.announcements).values([
    { academyId: academy.id, authorId: id(PROFESSOR.handle), body: "Exame de graduação no fim do mês! Quem está perto do próximo grau, fale comigo depois da aula.", pinned: true, createdAt: daysAgo(3, 21) },
    { academyId: academy.id, authorId: id(COACH.handle), body: "Turma de competição: tragam kimono azul e branco na terça.", pinned: false, createdAt: daysAgo(1, 22) },
  ]);

  // Events: an upcoming competition with sign-ups, a seminar, the graduation, and a past competition with medals.
  const at = (days: number, hour: number) => {
    const t = new Date(now + days * 86_400_000);
    t.setHours(hour, 0, 0, 0);
    return t;
  };
  const ymdOf = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const events = await db
    .insert(s.academyEvents)
    .values([
      { academyId: academy.id, kind: "competition" as const, title: "Lisbon International Open", startsAt: at(23, 9), endsAt: at(24, 19), location: "Pavilhão Municipal de Odivelas", url: "https://smoothcomp.com/en/events/upcoming", signupUntil: ymdOf(at(16, 0)), description: "Pesagem no dia, 30 min antes da luta. Levem kimono branco e azul.", createdBy: id(PROFESSOR.handle), createdAt: daysAgo(10) },
      { academyId: academy.id, kind: "seminar" as const, title: "Seminário de passagem de guarda", startsAt: at(9, 10), endsAt: at(9, 13), location: "Na academia", description: "Com professor convidado. 25 € para membros.", signupUntil: ymdOf(at(7, 0)), createdBy: id(PROFESSOR.handle), createdAt: daysAgo(5) },
      { academyId: academy.id, kind: "graduation" as const, title: "Exame de graduação", startsAt: at(16, 11), location: "Na academia", description: "Família e amigos são bem-vindos.", createdBy: id(PROFESSOR.handle), createdAt: daysAgo(3) },
      { academyId: academy.id, kind: "competition" as const, title: "Campeonato Regional de Lisboa", startsAt: daysAgo(12, 9), location: "Oeiras", url: "https://smoothcomp.com/en/events/upcoming", createdBy: id(PROFESSOR.handle), createdAt: daysAgo(40) },
    ])
    .returning({ id: s.academyEvents.id, title: s.academyEvents.title });
  const [open, seminar, , regional] = events;
  const division = (p: Person) => `Adulto · ${pt.belt[p.belt]}`;
  const byHandle = (h: string) => [COACH, ...STUDENTS].find((p) => p.handle === h)!;
  await db.insert(s.eventAttendees).values([
    ...["miguel", "andre", "ines", "tiago", "sofia"].map((h) => ({ eventId: open.id, userId: id(h), category: `${division(byHandle(h))} · ${pick(["-70 kg", "-76 kg", "-82 kg", "-88 kg"])}` })),
    ...["miguel", "ines", "pedro", "joao", "ana", "beatriz", "diogo"].map((h) => ({ eventId: seminar.id, userId: id(h) })),
    { eventId: regional.id, userId: id("andre"), category: "Adulto · Azul · -76 kg", result: "gold" as const },
    { eventId: regional.id, userId: id("ines"), category: "Adulto · Azul · -64 kg", result: "silver" as const },
    { eventId: regional.id, userId: id("miguel"), category: "Adulto · Roxa · -82 kg", result: "bronze" as const },
    { eventId: regional.id, userId: id("tiago"), category: "Adulto · Azul · -88 kg", result: "participated" as const },
    { eventId: regional.id, userId: id("pedro"), category: "Master 1 · Marrom · -94 kg", result: "gold" as const },
  ]);

  // Fees: plans, who is on which, and payments up to this month (a few late, a few still due, scholarships).
  const plans = await db
    .insert(s.membershipPlans)
    .values([
      { academyId: academy.id, name: "Mensal adulto", priceCents: 4500, periodMonths: 1 },
      { academyId: academy.id, name: "Trimestral", priceCents: 12000, periodMonths: 3 },
      { academyId: academy.id, name: "Jovem (até 17)", priceCents: 3500, periodMonths: 1 },
      { academyId: academy.id, name: "Bolsa", priceCents: 0, periodMonths: 1 },
    ])
    .returning();
  const [monthly, quarterly, junior, scholarship] = plans;
  const thisMonth = ymdOf(new Date(now)).slice(0, 7);
  const monthMinus = (n: number) => {
    const [y, m] = thisMonth.split("-").map(Number);
    const t = y * 12 + (m - 1) - n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  };
  const payments: (typeof s.payments.$inferInsert)[] = [];
  for (const p of STUDENTS) {
    const plan = SCHOLARSHIP.has(p.handle) ? scholarship : isMinor(p.birthYear) ? junior : ["pedro", "diogo", "sofia"].includes(p.handle) ? quarterly : monthly;
    await db.update(s.academyMembers).set({ planId: plan.id }).where(and(eq(s.academyMembers.academyId, academy.id), eq(s.academyMembers.userId, id(p.handle))));
    if (plan.priceCents === 0) continue;
    // Months paid: up to this month, last month (due), or two months ago (late).
    const lastPaid = LATE.has(p.handle) ? monthMinus(2) : DUE.has(p.handle) ? monthMinus(1) : thisMonth;
    for (let back = 5; back >= 0; back -= plan.periodMonths) {
      const from = monthMinus(back);
      if (from > lastPaid) break;
      payments.push({
        academyId: academy.id,
        userId: id(p.handle),
        planId: plan.id,
        amountCents: plan.priceCents,
        method: pick(["mbway", "mbway", "cash", "transfer"] as const),
        paidOn: `${from}-0${between(1, 8)}`,
        coversFrom: from,
        months: plan.periodMonths,
        recordedBy: id(PROFESSOR.handle),
      });
    }
  }
  await db.insert(s.payments).values(payments);
  // Due a few days from now, so the demo always has fees "a vencer" next to the late ones.
  await db.update(s.academies).set({ billingDueDay: Math.min(28, new Date(now).getDate() + 5) }).where(eq(s.academies.id, academy.id));
  for (const h of LATE) {
    notifications.push({ userId: id(h), actorId: id(PROFESSOR.handle), type: "payment_reminder", targetId: academy.id, createdAt: daysAgo(2, 9) });
  }

  for (let i = 0; i < notifications.length; i += 200) await db.insert(s.notifications).values(notifications.slice(i, i + 200));

  console.info(
    [
      `Demo pronta: ${everyone.length} contas, ${sessions.length} treinos, ${classes.length} aulas na semana, ${attendance.length} presenças em chamadas,`,
      `${events.length} eventos, ${plans.length} planos e ${payments.length} pagamentos na academia "${academy.name}".`,
      `Professor (dono):  ${email(PROFESSOR.handle)}`,
      `Professora (coach): ${email(COACH.handle)}`,
      `Aluno:             ${email("miguel")}   ·  menor de idade: ${email("lucas")}`,
      `Pedido pendente:   ${email("henrique")}`,
      "Entre com qualquer um destes e-mails; o código aparece no log da API.",
    ].join("\n"),
  );
  await handle.close();
}

void main();
