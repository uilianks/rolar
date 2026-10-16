import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AdminAcademyRow } from "@/lib/types";
import { ErrorText, Loading } from "@/ui/kit";
import { TechniqueForm } from "@/ui/technique-form";

/** Admin: write a technique and pick the (approved) academy it belongs to. */
export default function AdminTechniques() {
  const list = useQuery({ queryKey: ["admin", "academies", "approved"], queryFn: () => api<AdminAcademyRow[]>("/admin/academies?status=approved") });
  if (list.isPending) return <Loading />;
  if (!list.data) return <ErrorText error={list.error} />;
  return <TechniqueForm academies={list.data.map((a) => ({ id: a.id, name: a.name }))} />;
}
