// Domain vocabulary and validation shared by the app and the API.
import { z } from "zod";

export const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
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

const currentYear = () => new Date().getFullYear();

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, "3–30 caracteres: letras, números, _ ou .");

export const profileInput = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(80),
  birthYear: z
    .number()
    .int()
    .refine((y) => y >= 1900 && ageInYear(y, currentYear()) >= MIN_AGE, `É preciso ter ${MIN_AGE} anos ou mais`),
  belt: z.enum(BELTS),
  stripes: z.number().int().min(0).max(6),
  startedAt: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  weeklyGoal: z.number().int().min(0).max(14).default(3),
  defaultVisibility: z.enum(VISIBILITIES).default("followers"),
  searchable: z.boolean().default(true),
  showInRanking: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileInput>;

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
export const REQUESTER_ROLE_LABEL: Record<RequesterRole, string> = {
  owner: "Dono(a)",
  head_coach: "Professor(a) responsável",
  manager: "Gerente / administração",
};

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
export const academyInput = z
  .object({
    name: z.string().trim().min(2, "Nome: mínimo 2 caracteres").max(80),
    affiliation: optionalText(80),
    address: z.string().trim().min(5, "Informe a morada").max(200),
    postalCode: optionalText(20),
    city: z.string().trim().min(2, "Informe a cidade").max(80),
    country: z.string().trim().length(2, "País: código de 2 letras (PT, ES…)").toUpperCase(),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,30}$/, "Telefone inválido"),
    email: z.email("E-mail inválido").optional().or(z.literal("").transform(() => undefined)),
    website: z.url("Site inválido (comece com https://)").optional().or(z.literal("").transform(() => undefined)),
    instagram: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""))
      .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, "Instagram inválido"))
      .optional()
      .transform((v) => v || undefined),
    requesterRole: z.enum(REQUESTER_ROLES),
    proof: z.string().trim().min(20, "Explique como podemos confirmar (mínimo 20 caracteres)").max(2000),
  })
  .refine((a) => a.website || a.instagram, { message: "Informe o site ou o Instagram da academia", path: ["website"] });
export type AcademyInput = z.infer<typeof academyInput>;

export const ACADEMY_STATUS_LABEL: Record<AcademyStatus, string> = {
  pending: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
};

export const academyReview = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).optional() })
  .refine((r) => r.decision === "approve" || (r.note?.length ?? 0) >= 5, { message: "Explique o motivo da recusa", path: ["note"] });

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const WEEKDAY_LABEL = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;
export const WEEKDAY_SHORT = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/** A weekly class on the academy timetable (times are the academy's local time). */
export const classInput = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no formato HH:MM"),
  durationMin: z.number().int().min(15).max(300),
  title: z.string().trim().min(2, "Dê um nome à aula").max(60),
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
export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  competition: "Campeonato",
  seminar: "Seminário",
  graduation: "Graduação",
  open_mat: "Open mat",
  social: "Confraternização",
  other: "Outro",
};

const optionalUrl = z.url("Link inválido (comece com https://)").optional().or(z.literal("").transform(() => undefined));

/** Something on the academy calendar besides the weekly classes. Competitions take sign-ups and results. */
export const eventInput = z
  .object({
    kind: z.enum(EVENT_KINDS),
    title: z.string().trim().min(2, "Dê um nome ao evento").max(100),
    description: z.string().trim().max(3000).optional().transform((v) => v || undefined),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    location: z.string().trim().max(200).optional().transform((v) => v || undefined),
    url: optionalUrl,
    /** Last day students can sign up (competitions: the organizer's deadline). */
    signupUntil: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: "O fim é antes do início", path: ["endsAt"] });
export type EventInput = z.infer<typeof eventInput>;

export const RESULTS = ["gold", "silver", "bronze", "participated"] as const;
export type Result = (typeof RESULTS)[number];
export const RESULT_LABEL: Record<Result, string> = { gold: "Ouro", silver: "Prata", bronze: "Bronze", participated: "Participou" };

export const rsvpInput = z.object({
  /** Competitions: division as the athlete registered (e.g. "Adulto · Azul · -76 kg"). */
  category: z.string().trim().max(100).optional().transform((v) => v || undefined),
});

/** One date of a weekly class: cancelled (holiday) and/or a note; the topic is set with the roll call. */
export const occurrenceInput = z.object({
  cancelled: z.boolean(),
  note: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

// ---------- Board ----------

export const announcementInput = z.object({
  body: z.string().trim().min(2, "Escreva o aviso").max(2000),
  pinned: z.boolean().default(false),
});

// ---------- Billing (record keeping only: the app never moves money) ----------

export const PAYMENT_METHODS = ["cash", "mbway", "transfer", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  mbway: "MB Way",
  transfer: "Transferência",
  card: "Cartão",
  other: "Outro",
};

export const planInput = z.object({
  name: z.string().trim().min(2, "Dê um nome ao plano").max(60),
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
  coversFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês no formato AAAA-MM"),
  months: z.number().int().min(1).max(12),
  note: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

export const BILLING_STATUSES = ["paid", "due", "late", "exempt", "no_plan"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  paid: "Em dia",
  due: "A vencer",
  late: "Em atraso",
  exempt: "Isento",
  no_plan: "Sem plano",
};

/** "YYYY-MM" plus n months. */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function formatEuros(cents: number) {
  return `${(cents / 100).toLocaleString("pt-PT", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}

export const reportInput = z.object({
  targetType: z.enum(["user", "session", "comment", "academy"]),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export const KIND_LABEL: Record<SessionKind, string> = {
  gi: "Gi",
  nogi: "No-gi",
  open_mat: "Open mat",
  drill: "Drill",
  private: "Particular",
  competition: "Competição",
  teaching: "Dando aula",
};

export const BELT_LABEL: Record<Belt, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "Todos",
  followers: "Seguidores",
  private: "Só eu",
};
