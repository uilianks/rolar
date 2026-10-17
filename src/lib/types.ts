// Shapes returned by the API (server/routes/*).
import type {
  AcademyRole,
  AcademyStatus,
  Belt,
  BillingStatus,
  FinishCount,
  EventKind,
  PaymentMethod,
  ReportAction,
  ReportTarget,
  RequesterRole,
  Result,
  SessionKind,
  TechniqueCategory,
  TechniquePosition,
  Visibility,
} from "@/shared/domain";

export type Profile = {
  userId: string;
  username: string;
  name: string;
  birthYear: number;
  belt: Belt;
  stripes: number;
  startedAt: string | null;
  homeAcademyId: string | null;
  weeklyGoal: number;
  defaultVisibility: Visibility;
  searchable: boolean;
  showInRanking: boolean;
  avatarUrl: string | null;
};

export type AcademyRef = { id: string; name: string; slug: string };

export type TechniqueRef = { id: string; name: string; category: TechniqueCategory };
export type Technique = TechniqueRef & {
  aliases: string[];
  position: TechniquePosition | null;
  /** Null for the Rolar catalog (the app's own techniques). */
  academy: AcademyRef | null;
  /** The viewer marked it as known. */
  known: boolean;
};
export type TechniqueDetail = Technique & {
  description: string;
  updatedAt: string;
  author: { id: string; name: string; username: string } | null;
  leadsTo: TechniqueRef[];
  comesFrom: TechniqueRef[];
  canEdit: boolean;
  /** The viewer's private notes, or null when they wrote none. */
  myNotes: TechniqueNotes | null;
  /** The stored texts in both languages; only for those who can edit. */
  source?: { name: string; nameEn: string | null; description: string; descriptionEn: string | null };
};
export type TechniqueNotes = { body: string; updatedAt: string };
export type TechniqueGraph = { nodes: (TechniqueRef & { position: TechniquePosition | null })[]; links: { from: string; to: string }[] };

export type Me = {
  user: { id: string; email: string; name: string; image: string | null };
  profile: Profile | null;
  memberships: { academy: AcademyRef & { status: AcademyStatus }; role: AcademyRole; status: "pending" | "active" }[];
  flags: string[];
  unreadNotifications: number;
  /** Present only for admins. */
  admin: { pendingAcademies: number; openReports: number } | null;
};

/** Anyone shown by name: `avatarUrl` is their photo (API path) or null for initials. */
export type Person = { id: string; name: string; username: string; avatarUrl?: string | null };

export type Author = Person & { belt: Belt; stripes: number };

export type SessionCard = {
  id: string;
  kind: SessionKind;
  startedAt: string;
  durationMin: number;
  rounds: number;
  /** Null for a check-in session nobody filled in yet. */
  rpe: number | null;
  title: string | null;
  notes: string | null;
  techniques: string[];
  submissions: FinishCount[];
  taps: FinishCount[];
  visibility: Visibility;
  source: string;
  /** Created by a check-in and not yet filled in or skipped. */
  reviewPending: boolean;
  academy: AcademyRef | null;
  author: Author;
  ossCount: number;
  commentCount: number;
  ossed: boolean;
};

export type Comment = { id: string; body: string; createdAt: string; author: Omit<Author, "stripes"> };

export type SessionDetail = SessionCard & {
  comments: Comment[];
  ossBy: Person[];
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type Stats = {
  totals: { sessions: number; minutes: number; rounds: number };
  thisWeek: { sessions: number; minutes: number; goal: number; days: string[] };
  streakWeeks: number;
  byKind: { kind: SessionKind; sessions: number }[];
  weeklyLoad: { week: string; load: number }[];
  loadBand: "low" | "ideal" | "high" | "none";
  days: Record<string, number>;
  submissions: { total: number; top: FinishCount[] };
  taps: { total: number; top: FinishCount[] };
  range: string;
};

type FinishTally = { total: number; top: FinishCount[] };
type WeekSummary = { sessions: number; minutes: number; rounds: number; submissions: FinishTally; taps: FinishTally };

/** GET /me/week: one week (Monday `week`) against the week before. */
export type WeekReport = {
  week: string;
  current: WeekSummary & { days: string[]; byKind: { kind: SessionKind; sessions: number }[]; topTechniques: { name: string; count: number }[] };
  previous: WeekSummary;
  goal: number;
  goalMet: boolean;
  streakWeeks: number;
  inProgress: boolean;
  firstWeek: string | null;
};

export type MonthTrend = { month: string; sessions: number; minutes: number; submissions: number; taps: number };

export type Promotion = {
  id: string;
  belt: Belt;
  stripes: number;
  promotedOn: string;
  academyId: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
};

export type PublicProfile = Author & {
  startedAt: string | null;
  homeAcademy: AcademyRef | null;
  followers: number;
  following: number;
  isFollowing: boolean;
  canFollow: boolean;
  promotions: Promotion[];
};

export type Academy = AcademyRef & {
  affiliation: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  instagram: string | null;
  status: AcademyStatus;
  memberCount: number;
  membership?: { role: AcademyRole; status: "pending" | "active" } | null;
  /** Only for the owner. */
  registration?: AcademyRegistration | null;
};

export type AcademyRegistration = {
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  requesterRole: RequesterRole | null;
  proof: string | null;
  submittedAt: string;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type AdminAcademyRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  status: AcademyStatus;
  submittedAt: string;
  reviewedAt: string | null;
  requester: { name: string; username: string | null } | null;
};

export type AdminAcademy = Omit<Academy, "memberCount" | "membership" | "registration"> &
  Omit<AcademyRegistration, "submittedAt"> & {
    submittedAt: string;
    createdAt: string;
    reviewedBy: string | null;
    requester: { id: string; name: string; email: string; username: string | null; accountCreatedAt: string; sessions: number; academiesRegistered: number } | null;
    similar: { id: string; name: string; city: string | null; status: AcademyStatus }[];
    owner: { id: string; name: string; username: string } | null;
  };

export type AdminReportGroup = {
  targetType: ReportTarget;
  targetId: string;
  count: number;
  firstAt: string;
  reasons: string[];
  action: ReportAction | null;
  note: string | null;
  resolvedAt: string | null;
  /** Null once the content was deleted. */
  target: { title: string; body: string | null; owner: (Person & { suspended: boolean }) | null } | null;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  suspendedAt: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  sessions: number;
  followers: number;
  reports: number;
  isAdmin: boolean;
  profile: { name: string; username: string; avatarUrl: string | null; belt: Belt; stripes: number; birthYear: number; minor: boolean } | null;
  memberships: { id: string; name: string; role: AcademyRole; status: "pending" | "active" }[];
};

export type AdminFlag = { key: string; enabledForAll: boolean; usernames: string[] };

export type AdminStats = {
  users: number;
  users7d: number;
  users30d: number;
  active7d: number;
  active30d: number;
  sessions7d: number;
  sessions30d: number;
  academies: number;
  suspended: number;
  weeks: { week: string; signups: number; sessions: number }[];
};

export type Member = Author & { role: AcademyRole; status: "pending" | "active"; /** Staff only. */ attendance30d?: number };

export type AcademyClass = {
  id: string;
  academyId: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  title: string;
  kind: SessionKind;
};

export type AttendanceSheet = {
  class: AcademyClass;
  date: string;
  /** `logged`: the member logged a session matching this class (a self check-in to confirm). */
  members: (Author & { role: AcademyRole; present: boolean; logged: boolean; checkedIn: boolean })[];
} & Occurrence;

export type Occurrence = { cancelled: boolean; note: string | null; topic: string | null };

/** `sessionId`: the viewer's own session for that class and date, when they already have one. */
export type ClassWithOccurrence = AcademyClass & Partial<Occurrence> & { sessionId?: string | null };

export type AcademyEvent = {
  id: string;
  academyId: string;
  kind: EventKind;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  url: string | null;
  signupUntil: string | null;
  going: number;
  isGoing: boolean;
};

export type EventDetail = AcademyEvent & {
  attendees: (Author & { category: string | null; result: Result | null })[];
};

export type Calendar = {
  classes: AcademyClass[];
  occurrences: (Occurrence & { classId: string; date: string })[];
  events: AcademyEvent[];
};

export type Medals = {
  year: number;
  total: { gold: number; silver: number; bronze: number };
  athletes: (Person & { belt: Belt; gold: number; silver: number; bronze: number })[];
};

export type Announcement = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: Person | null;
};

export type InactiveMembers = { days: number; members: (Author & { joinedAt: string; lastSeen: string | null })[] };

export type Plan = { id: string; name: string; priceCents: number; periodMonths: number };

export type Payment = {
  id: string;
  userId: string;
  planId: string | null;
  amountCents: number;
  method: PaymentMethod;
  paidOn: string;
  coversFrom: string;
  months: number;
  note: string | null;
  createdAt: string;
};

export type BillingState = { status: BillingStatus; paidThrough: string | null; lateMonths: number };

export type BillingOverview = {
  billingDueDay: number;
  plans: Plan[];
  members: (Author & BillingState & { role: AcademyRole; planId: string | null; plan: Plan | null; lastPayment: Payment | null })[];
};

export type MyBilling = BillingState & { plan: Plan | null; billingDueDay: number; payments: Payment[] };

/** A recent class with no roll call although members logged it. */
export type PendingRollCall = { class: AcademyClass; date: string; logged: number };

export type RankingRow = Person & { belt: Belt; sessions: number; rank: number };

export type Notification = {
  id: string;
  type: string;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: Person | null;
};

export type PendingPromotion = {
  id: string;
  belt: Belt;
  stripes: number;
  promotedOn: string;
  academyId: string;
  user: Person;
};
