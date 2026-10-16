import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SessionInput } from "@/shared/domain";

import { api } from "./api";
import { authClient } from "./auth-client";
import type {
  Academy,
  AcademyClass,
  Me,
  Member,
  Notification,
  Page,
  PendingPromotion,
  PendingRollCall,
  Announcement,
  AcademyEvent,
  Calendar,
  InactiveMembers,
  Medals,
  MyBilling,
  PublicProfile,
  RankingRow,
  SessionCard,
  SessionDetail,
  Stats,
  Technique,
  TechniqueDetail,
  TechniqueGraph,
} from "./types";

export function useTechniques(filters: { q?: string; category?: string; academy?: string }) {
  const qs = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();
  return useQuery({ queryKey: ["techniques", filters], queryFn: () => api<Technique[]>(`/techniques${qs ? `?${qs}` : ""}`) });
}

export function useTechnique(id: string | undefined) {
  return useQuery({ queryKey: ["technique", id], queryFn: () => api<TechniqueDetail>(`/techniques/${id}`), enabled: !!id });
}

/** Approved academies where the viewer is active staff: where they can add techniques. */
export function useStaffAcademies() {
  const me = useMe().data;
  return (me?.memberships ?? [])
    .filter((m) => m.status === "active" && m.role !== "student" && m.academy.status === "approved")
    .map((m) => m.academy);
}

/** Marks or unmarks a technique as known; refreshes the catalog, the technique and the viewer's map. */
export function useToggleKnown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, known }: { id: string; known: boolean }) => api(`/techniques/${id}/known`, { method: known ? "PUT" : "DELETE" }),
    onSuccess: (_r, { id }) => Promise.all([qc.invalidateQueries({ queryKey: ["techniques"] }), qc.invalidateQueries({ queryKey: ["technique", id] })]),
  });
}

/** The viewer's own map: techniques they marked as known or logged in a session. */
export function useKnownTechniques() {
  return useQuery({ queryKey: ["techniques", "known"], queryFn: () => api<TechniqueGraph>("/techniques/known") });
}

export function useTechniqueGraph(academyId: string | undefined) {
  return useQuery({ queryKey: ["techniques", "graph", academyId], queryFn: () => api<TechniqueGraph>(`/techniques/graph?academy=${academyId}`), enabled: !!academyId });
}

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function useMe() {
  const { data: session } = authClient.useSession();
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), enabled: !!session });
}

export function useFeed(scope: "following" | "academy" | "me") {
  return useInfiniteQuery({
    queryKey: ["feed", scope],
    queryFn: ({ pageParam }) =>
      api<Page<SessionCard>>(`/feed?scope=${scope}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useUserSessions(username: string) {
  return useInfiniteQuery({
    queryKey: ["user-sessions", username],
    queryFn: ({ pageParam }) =>
      api<Page<SessionCard>>(`/users/${username}/sessions${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!username,
  });
}

export function useSession(id: string) {
  return useQuery({ queryKey: ["session", id], queryFn: () => api<SessionDetail>(`/sessions/${id}`), enabled: !!id });
}

export function useStats(range: "month" | "year" | "all" = "year") {
  return useQuery({ queryKey: ["stats", range], queryFn: () => api<Stats>(`/me/stats?tz=${encodeURIComponent(TZ)}&range=${range}`) });
}

export function useProfile(username: string) {
  return useQuery({ queryKey: ["profile", username], queryFn: () => api<PublicProfile>(`/users/${username}`), enabled: !!username });
}

export function useAcademy(id: string | null | undefined) {
  return useQuery({ queryKey: ["academy", id], queryFn: () => api<Academy>(`/academies/${id}`), enabled: !!id });
}

export function useAcademyMembers(id: string | null | undefined, enabled = true) {
  return useQuery({ queryKey: ["academy", id, "members"], queryFn: () => api<Member[]>(`/academies/${id}/members`), enabled: !!id && enabled });
}

export function useRanking(id: string | null | undefined, enabled = true) {
  return useQuery({ queryKey: ["academy", id, "ranking"], queryFn: () => api<RankingRow[]>(`/academies/${id}/ranking`), enabled: !!id && enabled });
}

export function useClasses(academyId: string | null | undefined) {
  return useQuery({ queryKey: ["academy", academyId, "classes"], queryFn: () => api<AcademyClass[]>(`/academies/${academyId}/classes`), enabled: !!academyId });
}

export function usePendingRollCalls(academyId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["academy", academyId, "pending-roll-calls"],
    queryFn: () => api<PendingRollCall[]>(`/academies/${academyId}/attendance/pending?tz=${encodeURIComponent(TZ)}`),
    enabled: !!academyId && enabled,
  });
}

export function useCalendar(academyId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["academy", academyId, "calendar", from, to],
    queryFn: () => api<Calendar>(`/academies/${academyId}/calendar?from=${from}&to=${to}`),
    enabled: !!academyId,
  });
}

export function useEvents(academyId: string | null | undefined) {
  return useQuery({ queryKey: ["academy", academyId, "events"], queryFn: () => api<AcademyEvent[]>(`/academies/${academyId}/events`), enabled: !!academyId });
}

export function useMedals(academyId: string | null | undefined) {
  return useQuery({ queryKey: ["academy", academyId, "medals"], queryFn: () => api<Medals>(`/academies/${academyId}/medals`), enabled: !!academyId });
}

export function useAnnouncements(academyId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["academy", academyId, "announcements"],
    queryFn: () => api<Announcement[]>(`/academies/${academyId}/announcements`),
    enabled: !!academyId && enabled,
  });
}

export function useInactive(academyId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["academy", academyId, "inactive"],
    queryFn: () => api<InactiveMembers>(`/academies/${academyId}/inactive?days=14`),
    enabled: !!academyId && enabled,
  });
}

export function useMyBilling(academyId: string | null | undefined, enabled: boolean) {
  return useQuery({ queryKey: ["academy", academyId, "billing", "me"], queryFn: () => api<MyBilling>(`/academies/${academyId}/billing/me`), enabled: !!academyId && enabled });
}

export function usePendingPromotions() {
  return useQuery({ queryKey: ["promotions", "pending"], queryFn: () => api<PendingPromotion[]>("/promotions/pending") });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/me/notifications") });
}

/** Everything that changes sessions refreshes the views built from them. */
function useInvalidateTraining() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["feed"] }),
      qc.invalidateQueries({ queryKey: ["stats"] }),
      qc.invalidateQueries({ queryKey: ["user-sessions"] }),
      qc.invalidateQueries({ queryKey: ["academy"] }),
    ]);
}

export function useCreateSession() {
  const invalidate = useInvalidateTraining();
  return useMutation({
    mutationFn: (input: SessionInput) => api<SessionCard>("/sessions", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidateTraining();
  return useMutation({
    mutationFn: (id: string) => api(`/sessions/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useToggleOss() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/sessions/${id}/oss`, { method: on ? "POST" : "DELETE" }),
    onSettled: (_d, _e, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["feed"] }),
        qc.invalidateQueries({ queryKey: ["session", id] }),
        qc.invalidateQueries({ queryKey: ["user-sessions"] }),
      ]),
  });
}

/** Generic mutation that refreshes the given query keys afterwards. */
export function useApiMutation<V>(fn: (v: V) => Promise<unknown>, refresh: unknown[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(refresh.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
