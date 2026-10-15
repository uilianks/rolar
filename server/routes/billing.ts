import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { addMonths, type BillingStatus, paymentInput, planInput } from "../../src/shared/domain";
import type { Db } from "../db/client";
import * as s from "../db/schema";
import { type AppEnv, body, fail, t, viewer } from "../http";
import { notify } from "../notify";
import { membership } from "../policies";
import { requireMember, requireBillingManager } from "./academies";

/**
 * Membership fees, as records kept by the owner: plans, who is on which plan, payments received and
 * who is late. The app never charges anyone. Only the owner sees other people's billing.
 */
export const billingRoutes = new Hono<AppEnv>();

type Plan = { id: string; name: string; priceCents: number; periodMonths: number };

/**
 * Where a member stands this month. Months are "YYYY-MM"; a month is covered by any payment whose range
 * includes it. Unpaid months before this one are late; this month becomes late after the due day.
 */
export function billingStatus(plan: Plan | null, payments: { coversFrom: string; months: number }[], today: string, dueDay: number) {
  if (!plan) return { status: "no_plan" as BillingStatus, paidThrough: null, lateMonths: 0 };
  const covered = new Set(payments.flatMap((p) => Array.from({ length: p.months }, (_, i) => addMonths(p.coversFrom, i))));
  const paidThrough = [...covered].sort().at(-1) ?? null;
  if (plan.priceCents === 0) return { status: "exempt" as BillingStatus, paidThrough, lateMonths: 0 };
  const current = today.slice(0, 7);
  if (covered.has(current) || (paidThrough && paidThrough > current)) return { status: "paid" as BillingStatus, paidThrough, lateMonths: 0 };
  // Owed: from the month after the last one paid (or this month, if nothing was ever recorded) to now.
  const owed: string[] = [];
  for (let m = paidThrough ? addMonths(paidThrough, 1) : current; m <= current; m = addMonths(m, 1)) owed.push(m);
  const lateMonths = owed.filter((m) => m < current || Number(today.slice(8, 10)) > dueDay).length;
  return { status: (lateMonths ? "late" : "due") as BillingStatus, paidThrough, lateMonths };
}

const planColumns = { id: s.membershipPlans.id, name: s.membershipPlans.name, priceCents: s.membershipPlans.priceCents, periodMonths: s.membershipPlans.periodMonths };

async function plansOf(db: Db, academyId: string) {
  return db.select(planColumns).from(s.membershipPlans).where(and(eq(s.membershipPlans.academyId, academyId), isNull(s.membershipPlans.archivedAt))).orderBy(asc(s.membershipPlans.priceCents));
}

async function paymentsOf(db: Db, academyId: string, userId?: string) {
  return db
    .select({
      id: s.payments.id,
      userId: s.payments.userId,
      planId: s.payments.planId,
      amountCents: s.payments.amountCents,
      method: s.payments.method,
      paidOn: s.payments.paidOn,
      coversFrom: s.payments.coversFrom,
      months: s.payments.months,
      note: s.payments.note,
      createdAt: s.payments.createdAt,
    })
    .from(s.payments)
    .where(and(eq(s.payments.academyId, academyId), userId ? eq(s.payments.userId, userId) : undefined))
    .orderBy(desc(s.payments.paidOn), desc(s.payments.createdAt));
}

const today = () => new Date().toISOString().slice(0, 10);

billingRoutes.get("/academies/:id/plans", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  return c.json(await plansOf(c.get("db"), a.id));
});

billingRoutes.post("/academies/:id/plans", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const input = await body(c, planInput);
  const [p] = await c.get("db").insert(s.membershipPlans).values({ ...input, academyId: a.id }).returning(planColumns);
  return c.json(p, 201);
});

billingRoutes.put("/academies/:id/plans/:planId", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const input = await body(c, planInput);
  const [p] = await c
    .get("db")
    .update(s.membershipPlans)
    .set(input)
    .where(and(eq(s.membershipPlans.id, c.req.param("planId")), eq(s.membershipPlans.academyId, a.id)))
    .returning(planColumns);
  if (!p) fail(404, "planNotFound");
  return c.json(p);
});

/** Archived so past payments keep their plan; members on it go back to "no plan". */
billingRoutes.delete("/academies/:id/plans/:planId", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const db = c.get("db");
  const planId = c.req.param("planId");
  await db.update(s.membershipPlans).set({ archivedAt: new Date() }).where(and(eq(s.membershipPlans.id, planId), eq(s.membershipPlans.academyId, a.id)));
  await db.update(s.academyMembers).set({ planId: null }).where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.planId, planId)));
  return c.body(null, 204);
});

billingRoutes.patch("/academies/:id/billing/settings", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const { billingDueDay } = await body(c, z.object({ billingDueDay: z.number().int().min(1).max(28) }));
  await c.get("db").update(s.academies).set({ billingDueDay }).where(eq(s.academies.id, a.id));
  return c.json({ billingDueDay });
});

/** Every active member with plan and status; the owner's overview. */
billingRoutes.get("/academies/:id/billing", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const db = c.get("db");
  const [{ billingDueDay }] = await db.select({ billingDueDay: s.academies.billingDueDay }).from(s.academies).where(eq(s.academies.id, a.id));
  const plans = await plansOf(db, a.id);
  const members = await db
    .select({
      id: s.profiles.userId,
      name: s.profiles.name,
      username: s.profiles.username,
      avatarUrl: s.profiles.avatarUrl,
      belt: s.profiles.belt,
      stripes: s.profiles.stripes,
      role: s.academyMembers.role,
      planId: s.academyMembers.planId,
    })
    .from(s.academyMembers)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.academyMembers.userId))
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.status, "active")))
    .orderBy(asc(s.profiles.name));
  const payments = await paymentsOf(db, a.id);
  const day = today();
  return c.json({
    billingDueDay,
    plans,
    members: members.map((m) => {
      const plan = plans.find((p) => p.id === m.planId) ?? null;
      const own = payments.filter((p) => p.userId === m.id);
      return { ...m, plan, lastPayment: own[0] ?? null, ...billingStatus(plan, own, day, billingDueDay) };
    }),
  });
});

/** The member's own fee status (shown on the academy page). */
billingRoutes.get("/academies/:id/billing/me", async (c) => {
  const userId = viewer(c);
  const { a, m } = await requireMember(c, c.req.param("id"));
  const db = c.get("db");
  const [row] = await db
    .select({ planId: s.academyMembers.planId, billingDueDay: s.academies.billingDueDay })
    .from(s.academyMembers)
    .innerJoin(s.academies, eq(s.academies.id, s.academyMembers.academyId))
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.userId, m.userId)));
  const [plan] = row.planId ? await db.select(planColumns).from(s.membershipPlans).where(eq(s.membershipPlans.id, row.planId)) : [];
  const payments = await paymentsOf(db, a.id, userId);
  return c.json({ plan: plan ?? null, billingDueDay: row.billingDueDay, payments, ...billingStatus(plan ?? null, payments, today(), row.billingDueDay) });
});

billingRoutes.patch("/academies/:id/members/:userId/plan", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const db = c.get("db");
  const { planId } = await body(c, z.object({ planId: z.string().nullable() }));
  if (planId && !(await plansOf(db, a.id)).some((p) => p.id === planId)) fail(400, "invalidPlan");
  const target = await membership(db, a.id, c.req.param("userId"));
  if (target?.status !== "active") fail(404, "memberNotFound");
  await db.update(s.academyMembers).set({ planId }).where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.userId, target.userId)));
  return c.body(null, 204);
});

billingRoutes.get("/academies/:id/members/:userId/payments", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  return c.json(await paymentsOf(c.get("db"), a.id, c.req.param("userId")));
});

billingRoutes.post("/academies/:id/payments", async (c) => {
  const ownerId = viewer(c);
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const db = c.get("db");
  const input = await body(c, paymentInput);
  const target = await membership(db, a.id, input.userId);
  if (target?.status !== "active") fail(400, "activeMembersOnly");
  const [row] = await db
    .select({ planId: s.academyMembers.planId })
    .from(s.academyMembers)
    .where(and(eq(s.academyMembers.academyId, a.id), eq(s.academyMembers.userId, input.userId)));
  const [p] = await db
    .insert(s.payments)
    .values({ ...input, academyId: a.id, planId: row.planId, recordedBy: ownerId })
    .returning({ id: s.payments.id });
  return c.json(p, 201);
});

/** Undo a payment recorded by mistake. */
billingRoutes.delete("/academies/:id/payments/:paymentId", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  await c.get("db").delete(s.payments).where(and(eq(s.payments.id, c.req.param("paymentId")), eq(s.payments.academyId, a.id)));
  return c.body(null, 204);
});

/** In-app reminder to a member; at most one a day per member so it never turns into spam. */
billingRoutes.post("/academies/:id/members/:userId/remind", async (c) => {
  const ownerId = viewer(c);
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const db = c.get("db");
  const target = await membership(db, a.id, c.req.param("userId"));
  if (target?.status !== "active") fail(404, "memberNotFound");
  const [recent] = await db
    .select({ id: s.notifications.id })
    .from(s.notifications)
    .where(
      and(
        eq(s.notifications.userId, target.userId),
        eq(s.notifications.type, "payment_reminder"),
        eq(s.notifications.targetId, a.id),
        gte(s.notifications.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  if (recent) fail(409, "reminderSentRecently");
  await notify(db, "payment_reminder", ownerId, [target.userId], a.id);
  return c.body(null, 204);
});

/** Payments received in a month (by payment date), for the accountant. */
billingRoutes.get("/academies/:id/payments.csv", async (c) => {
  const { a } = await requireBillingManager(c, c.req.param("id"));
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(today().slice(0, 7)).parse(c.req.query("month"));
  const rows = await c
    .get("db")
    .select({
      paidOn: s.payments.paidOn,
      name: s.profiles.name,
      plan: s.membershipPlans.name,
      coversFrom: s.payments.coversFrom,
      months: s.payments.months,
      amountCents: s.payments.amountCents,
      method: s.payments.method,
      note: s.payments.note,
    })
    .from(s.payments)
    .innerJoin(s.profiles, eq(s.profiles.userId, s.payments.userId))
    .leftJoin(s.membershipPlans, eq(s.membershipPlans.id, s.payments.planId))
    .where(and(eq(s.payments.academyId, a.id), gte(s.payments.paidOn, `${month}-01`), lte(s.payments.paidOn, `${month}-31`)))
    .orderBy(asc(s.payments.paidOn), asc(s.profiles.name));
  const cell = (v: string | number | null) => {
    const t = String(v ?? "");
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // Semicolons and decimal commas: what Excel expects in Portugal, whatever the language.
  const m = t(c);
  const lines = [
    m.paymentsCsv.header,
    ...rows.map((r) => [r.paidOn, r.name, r.plan, r.coversFrom, r.months, (r.amountCents / 100).toFixed(2).replace(".", ","), m.paymentMethod[r.method], r.note]),
  ].map((l) => l.map(cell).join(";"));
  return c.body(`﻿${lines.join("\r\n")}\r\n`, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${m.paymentsCsv.filename(month)}"`,
  });
});
