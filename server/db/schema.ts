import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  ACADEMY_ROLES,
  ACADEMY_STATUSES,
  BELTS,
  EVENT_KINDS,
  PAYMENT_METHODS,
  REQUESTER_ROLES,
  RESULTS,
  SESSION_KINDS,
  VISIBILITIES,
} from "../../src/shared/domain";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Better Auth (table and column names follow its default model) ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Set by an admin (moderation): the account cannot sign in and its content is hidden from others.
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Better Auth rate-limit counters, shared by every serverless instance. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------- Domain ----------

export const beltEnum = pgEnum("belt", BELTS);
export const sessionKindEnum = pgEnum("session_kind", SESSION_KINDS);
export const visibilityEnum = pgEnum("visibility", VISIBILITIES);
export const academyRoleEnum = pgEnum("academy_role", ACADEMY_ROLES);
export const membershipStatusEnum = pgEnum("membership_status", ["pending", "active"]);
export const academyStatusEnum = pgEnum("academy_status", ACADEMY_STATUSES);
export const requesterRoleEnum = pgEnum("requester_role", REQUESTER_ROLES);
export const eventKindEnum = pgEnum("event_kind", EVENT_KINDS);
export const resultEnum = pgEnum("competition_result", RESULTS);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    name: text("name").notNull(),
    birthYear: integer("birth_year").notNull(),
    belt: beltEnum("belt").notNull(),
    stripes: integer("stripes").notNull().default(0),
    startedAt: text("started_at"), // YYYY-MM
    homeAcademyId: text("home_academy_id").references(() => academies.id, { onDelete: "set null" }),
    weeklyGoal: integer("weekly_goal").notNull().default(3),
    defaultVisibility: visibilityEnum("default_visibility").notNull().default("followers"),
    searchable: boolean("searchable").notNull().default(true),
    showInRanking: boolean("show_in_ranking").notNull().default(true),
    /** Versioned path of the profile photo (`/api/avatars/:userId?v=…`), or null for initials. */
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("profiles_username_idx").on(t.username)],
);

/**
 * Profile photos, small enough to live in Postgres for now (256×256 JPEG, ~20 KB): no storage service
 * to run or pay for. Move to object storage together with session photos (phase 2).
 */
export const avatars = pgTable("avatars", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const academies = pgTable(
  "academies",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    affiliation: text("affiliation"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    instagram: text("instagram"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    // Verification: only approved academies are visible to others and accept members.
    status: academyStatusEnum("status").notNull().default("pending"),
    requesterRole: requesterRoleEnum("requester_role"),
    proof: text("proof"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Day of the month a membership fee is due; after it, an unpaid month is late. */
    billingDueDay: integer("billing_due_day").notNull().default(8),
    /** Secret in the academy's printed check-in QR; the owner rotates it if the QR leaks. */
    checkinToken: text("checkin_token").notNull().default(sql`md5(random()::text || clock_timestamp()::text)`),
  },
  (t) => [uniqueIndex("academies_slug_idx").on(t.slug), index("academies_status_idx").on(t.status, t.submittedAt)],
);

export const academyMembers = pgTable(
  "academy_members",
  {
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: academyRoleEnum("role").notNull().default("student"),
    status: membershipStatusEnum("status").notNull().default("pending"),
    planId: text("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.academyId, t.userId] }), index("academy_members_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    academyId: text("academy_id").references(() => academies.id, { onDelete: "set null" }),
    kind: sessionKindEnum("kind").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    rounds: integer("rounds").notNull().default(0),
    rpe: integer("rpe").notNull(),
    title: text("title"),
    notes: text("notes"),
    techniques: text("techniques").array().notNull().default(sql`'{}'::text[]`),
    visibility: visibilityEnum("visibility").notNull(),
    source: text("source").notNull().default("manual"),
    createdAt: createdAt(),
  },
  (t) => [
    index("sessions_user_started_idx").on(t.userId, t.startedAt),
    index("sessions_academy_started_idx").on(t.academyId, t.startedAt),
  ],
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    followeeId: text("followee_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);

export const reactions = pgTable(
  "reactions",
  {
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_session_idx").on(t.sessionId, t.createdAt)],
);

export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    belt: beltEnum("belt").notNull(),
    stripes: integer("stripes").notNull().default(0),
    promotedOn: text("promoted_on").notNull(), // YYYY-MM-DD
    academyId: text("academy_id").references(() => academies.id, { onDelete: "set null" }),
    confirmedBy: text("confirmed_by").references(() => user.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("promotions_user_idx").on(t.userId)],
);

/** Weekly timetable; archived instead of deleted so past roll calls keep their class. */
export const academyClasses = pgTable(
  "academy_classes",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // ISO: 1 = Monday … 7 = Sunday
    startTime: text("start_time").notNull(), // HH:MM, academy local time
    durationMin: integer("duration_min").notNull(),
    title: text("title").notNull(),
    kind: sessionKindEnum("kind").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("academy_classes_academy_idx").on(t.academyId, t.weekday, t.startTime)],
);

/** Roll call: a member confirmed present by staff at one class on one date. */
export const attendance = pgTable(
  "attendance",
  {
    classId: text("class_id").notNull().references(() => academyClasses.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    markedBy: text("marked_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.classId, t.date, t.userId] }), index("attendance_user_idx").on(t.userId, t.date)],
);

/** One date of a weekly class: cancellation, a note for students, and the topic taught. */
export const classOccurrences = pgTable(
  "class_occurrences",
  {
    classId: text("class_id").notNull().references(() => academyClasses.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    note: text("note"),
    topic: text("topic"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.classId, t.date] })],
);

/** Self check-in by QR at the gym: a request for staff to confirm in the roll call. */
export const checkins = pgTable(
  "checkins",
  {
    classId: text("class_id").notNull().references(() => academyClasses.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.classId, t.date, t.userId] }), index("checkins_user_idx").on(t.userId, t.date)],
);

export const academyEvents = pgTable(
  "academy_events",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    kind: eventKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    url: text("url"),
    signupUntil: text("signup_until"), // YYYY-MM-DD
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("academy_events_academy_idx").on(t.academyId, t.startsAt)],
);

/** "I'm going"; for competitions also the division and, afterwards, the result. */
export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: text("event_id").notNull().references(() => academyEvents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    category: text("category"),
    result: resultEnum("result"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("event_attendees_user_idx").on(t.userId)],
);

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_academy_idx").on(t.academyId, t.createdAt)],
);

export const membershipPlans = pgTable(
  "membership_plans",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    periodMonths: integer("period_months").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("membership_plans_academy_idx").on(t.academyId)],
);

/** Fees recorded by the owner (the app does not process payments). Covers `months` from `coversFrom`. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    academyId: text("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull(),
    paidOn: text("paid_on").notNull(), // YYYY-MM-DD
    coversFrom: text("covers_from").notNull(), // YYYY-MM
    months: integer("months").notNull().default(1),
    note: text("note"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_academy_user_idx").on(t.academyId, t.userId, t.coversFrom)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // oss | comment | follow | membership_approved | membership_request | promotion_confirmed | promotion_request
    targetId: text("target_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    /** What the admin did (REPORT_ACTIONS) and why; every open report on the same target is resolved together. */
    action: text("action"),
    note: text("note"),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("reports_target_idx").on(t.targetType, t.targetId), index("reports_status_idx").on(t.status, t.createdAt)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabledForAll: boolean("enabled_for_all").notNull().default(false),
  userIds: text("user_ids").array().notNull().default(sql`'{}'::text[]`),
});
