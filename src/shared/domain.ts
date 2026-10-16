// Domain vocabulary and validation shared by the app and the API.
import { z } from "zod";

import type { Messages } from "./i18n/pt";

/** Schemas carry `validation` keys as messages; the app and the API translate them (validationMessage). */
const v = (key: keyof Messages["validation"]) => key;

/** IBJJF kids belts (4–15 anos), lowest first; each colour comes with a white- and a black-centred variant. */
export const KIDS_BELTS = [
  "grey_white", "grey", "grey_black",
  "yellow_white", "yellow", "yellow_black",
  "orange_white", "orange", "orange_black",
  "green_white", "green", "green_black",
] as const;
export const ADULT_BELTS = ["white", "blue", "purple", "brown", "black"] as const;
/** Every belt, lowest rank first; academy rosters sort by this order. */
export const BELTS = [...KIDS_BELTS, ...ADULT_BELTS] as const;
export type Belt = (typeof BELTS)[number];

export const SESSION_KINDS = ["gi", "nogi", "open_mat", "drill", "private", "competition", "teaching"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const VISIBILITIES = ["public", "followers", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ACADEMY_ROLES = ["owner", "coach", "student"] as const;
export type AcademyRole = (typeof ACADEMY_ROLES)[number];

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** Age reached during `year`; birth year is all we store, so this is the conservative bound. */
export function ageInYear(birthYear: number, year = new Date().getFullYear()) {
  return year - birthYear;
}
export function isMinor(birthYear: number, year?: number) {
  return ageInYear(birthYear, year) < ADULT_AGE;
}

/** Belts a picker offers: kids belts only to minors, but never hide the belt already held. */
export function beltOptions(birthYear: number | null | undefined, current?: Belt): readonly Belt[] {
  if (birthYear && isMinor(birthYear)) return BELTS;
  return current && KIDS_BELTS.some((b) => b === current) ? [current, ...ADULT_BELTS] : ADULT_BELTS;
}

const currentYear = () => new Date().getFullYear();

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, v("username"));

/** Sessions per week a goal can ask for; 0 means no goal. */
export const WEEKLY_GOAL_MAX = 14;

export const profileInput = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(80),
  birthYear: z
    .number()
    .int()
    .refine((y) => y >= 1900 && ageInYear(y, currentYear()) >= MIN_AGE, v("minAge")),
  belt: z.enum(BELTS),
  stripes: z.number().int().min(0).max(6),
  startedAt: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  weeklyGoal: z.number().int().min(0).max(WEEKLY_GOAL_MAX).default(3),
  defaultVisibility: z.enum(VISIBILITIES).default("followers"),
  searchable: z.boolean().default(true),
  showInRanking: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileInput>;

/** Profile photo as a data URL; the app sends a 256×256 JPEG, the API accepts up to ~150 KB. */
export const AVATAR_MAX_BYTES = 150_000;
export const avatarInput = z.object({
  image: z
    .string()
    .max(Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64, v("imageTooLarge"))
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, v("imageType")),
});

export const profilePatch = profileInput.omit({ birthYear: true }).partial();

export const sessionInput = z.object({
  kind: z.enum(SESSION_KINDS),
  startedAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(1).max(24 * 60),
  rounds: z.number().int().min(0).max(100).default(0),
  rpe: z.number().int().min(1).max(10),
  title: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
  techniques: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  academyId: z.string().nullable().optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  source: z.enum(["manual", "timer"]).default("manual"),
});
export type SessionInput = z.infer<typeof sessionInput>;

export const commentInput = z.object({ body: z.string().trim().min(1).max(2000) });

export const ACADEMY_STATUSES = ["pending", "approved", "rejected"] as const;
export type AcademyStatus = (typeof ACADEMY_STATUSES)[number];

/** How the person registering relates to the academy. */
export const REQUESTER_ROLES = ["owner", "head_coach", "manager"] as const;
export type RequesterRole = (typeof REQUESTER_ROLES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

/**
 * Registration of an academy. Everything an admin needs to confirm that the academy exists and that
 * the requester runs it: public contact channels to check against, and how to verify the requester.
 */
const academyFields = z.object({
  name: z.string().trim().min(2, v("academyName")).max(80),
  affiliation: optionalText(80),
  address: z.string().trim().min(5, v("address")).max(200),
  postalCode: optionalText(20),
  city: z.string().trim().min(2, v("city")).max(80),
  country: z.string().trim().length(2, v("country")).toUpperCase(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,30}$/, v("phone")),
  email: z.email(v("email")).optional().or(z.literal("").transform(() => undefined)),
  website: z.url(v("website")).optional().or(z.literal("").transform(() => undefined)),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, v("instagram")))
    .optional()
    .transform((v) => v || undefined),
});
const hasWebOrInstagram = (a: { website?: string; instagram?: string }) => !!(a.website || a.instagram);
const webOrInstagramIssue = { message: v("webOrInstagram"), path: ["website"] };

export const academyInput = academyFields
  .extend({
    requesterRole: z.enum(REQUESTER_ROLES),
    proof: z.string().trim().min(20, v("proof")).max(2000),
  })
  .refine(hasWebOrInstagram, webOrInstagramIssue);
/** Admin correction of an academy's details (any status); its address (slug) never changes. */
export const academyEdit = academyFields.refine(hasWebOrInstagram, webOrInstagramIssue);
export type AcademyInput = z.infer<typeof academyInput>;

export const academyReview = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).optional() })
  .refine((r) => r.decision === "approve" || (r.note?.length ?? 0) >= 5, { message: v("rejectReason"), path: ["note"] });

/** A weekly class on the academy timetable (times are the academy's local time). */
export const classInput = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, v("time")),
  durationMin: z.number().int().min(15).max(300),
  title: z.string().trim().min(2, v("classTitle")).max(60),
  kind: z.enum(SESSION_KINDS),
});
export type ClassInput = z.infer<typeof classInput>;

/** Roll call: who was present at one class on one date. Replaces the previous list for that date. */
export const attendanceInput = z.object({
  date: z.iso.date(),
  userIds: z.array(z.string().min(1)).max(500),
  /** What was taught; shown in the calendar and prefilled into the students' session logs. */
  topic: z.string().trim().max(200).optional().transform((v) => v || undefined),
});

// ---------- Calendar ----------

export const EVENT_KINDS = ["competition", "seminar", "graduation", "open_mat", "social", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const optionalUrl = z.url(v("link")).optional().or(z.literal("").transform(() => undefined));

/** Something on the academy calendar besides the weekly classes. Competitions take sign-ups and results. */
export const eventInput = z
  .object({
    kind: z.enum(EVENT_KINDS),
    title: z.string().trim().min(2, v("eventTitle")).max(100),
    description: z.string().trim().max(3000).optional().transform((v) => v || undefined),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    location: z.string().trim().max(200).optional().transform((v) => v || undefined),
    url: optionalUrl,
    /** Last day students can sign up (competitions: the organizer's deadline). */
    signupUntil: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: v("endBeforeStart"), path: ["endsAt"] });
export type EventInput = z.infer<typeof eventInput>;

export const RESULTS = ["gold", "silver", "bronze", "participated"] as const;
export type Result = (typeof RESULTS)[number];

export const rsvpInput = z.object({
  /** Competitions: division as the athlete registered (e.g. "Adulto · Azul · -76 kg"). */
  category: z.string().trim().max(100).optional().transform((v) => v || undefined),
});

/** One date of a weekly class: cancelled (holiday) and/or a note; the topic is set with the roll call. */
export const occurrenceInput = z.object({
  cancelled: z.boolean(),
  note: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

// ---------- Techniques (text-only catalog written by academy staff) ----------

export const TECHNIQUE_CATEGORIES = ["takedown", "guard", "pass", "sweep", "control", "submission", "escape"] as const;
export type TechniqueCategory = (typeof TECHNIQUE_CATEGORIES)[number];

export const TECHNIQUE_POSITIONS = [
  "standing", "closed_guard", "open_guard", "half_guard", "side_control", "mount", "knee_on_belly", "back", "turtle", "leg_entanglement",
] as const;
export type TechniquePosition = (typeof TECHNIQUE_POSITIONS)[number];

export const techniqueInput = z.object({
  name: z.string().trim().min(2, v("techniqueName")).max(80),
  /** Other names for the same move ("armbar", "chave de braço"); the search matches them too. */
  aliases: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  category: z.enum(TECHNIQUE_CATEGORIES),
  position: z.enum(TECHNIQUE_POSITIONS).nullable().default(null),
  description: z.string().trim().max(10_000).default(""),
  /** English versions, for the Rolar catalog (bilingual); academies write in their own language. */
  nameEn: z.string().trim().max(80).nullable().default(null).transform((s) => s || null),
  descriptionEn: z.string().trim().max(10_000).nullable().default(null).transform((s) => s || null),
  /** Ids of the same catalog's techniques this one leads to (a chain, drawn as the technique graph). */
  leadsTo: z.array(z.string().min(1).max(64)).max(20).default([]),
});

// ---------- Board ----------

export const announcementInput = z.object({
  body: z.string().trim().min(2, v("announcement")).max(2000),
  pinned: z.boolean().default(false),
});

// ---------- Billing (record keeping only: the app never moves money) ----------

export const PAYMENT_METHODS = ["cash", "mbway", "transfer", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const planInput = z.object({
  name: z.string().trim().min(2, v("planName")).max(60),
  /** Cents; 0 = exempt (scholarship, staff). */
  priceCents: z.number().int().min(0).max(1_000_000),
  periodMonths: z.number().int().min(1).max(12),
});

export const paymentInput = z.object({
  userId: z.string().min(1),
  amountCents: z.number().int().min(0).max(10_000_000),
  method: z.enum(PAYMENT_METHODS),
  paidOn: z.iso.date(),
  /** First month covered, YYYY-MM. */
  coversFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, v("month")),
  months: z.number().int().min(1).max(12),
  note: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

export const BILLING_STATUSES = ["paid", "due", "late", "exempt", "no_plan"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/** "YYYY-MM" plus n months. */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const REPORT_TARGETS = ["user", "session", "comment", "academy"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const reportInput = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3).max(1000),
});

/**
 * What an admin does with the reports on one target. "remove" deletes a session or comment and
 * rejects an academy (hiding it); the profile itself is never deleted, only suspended. Suspending and
 * rejecting tell the person why, so they need a note.
 */
export const REPORT_ACTIONS = ["dismiss", "remove", "remove_avatar", "suspend"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];
export const reportResolution = z
  .object({
    targetType: z.enum(REPORT_TARGETS),
    targetId: z.string().min(1),
    action: z.enum(REPORT_ACTIONS),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((r) => r.action !== "remove" || r.targetType !== "user", { message: v("profilesNotRemoved"), path: ["action"] })
  .refine((r) => !(r.action === "suspend" || (r.action === "remove" && r.targetType === "academy")) || (r.note?.length ?? 0) >= 5, {
    message: v("reasonForPerson"),
    path: ["note"],
  });

export const suspensionInput = z.object({ reason: z.string().trim().min(5, v("reasonForPerson")).max(1000) });

/** Feature flag: on for everyone, or only for the listed usernames (beta testers). */
export const featureFlagInput = z.object({
  enabledForAll: z.boolean(),
  usernames: z.array(usernameSchema).max(500).default([]),
});
export const FLAG_KEY = /^[a-z0-9][a-z0-9_-]{1,39}$/;

