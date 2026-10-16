import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";

import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useTechnique } from "@/lib/queries";
import type { AdminAcademyRow } from "@/lib/types";
import { ErrorText, Loading } from "@/ui/kit";
import { ROLAR, TechniqueForm } from "@/ui/technique-form";

/**
 * Admin: write a technique for the Rolar catalog or an approved academy (`?catalogo=rolar` picks
 * Rolar), or edit one (`?techniqueId=`, how Rolar techniques are edited).
 */
export default function AdminTechniques() {
  const t = useT();
  const { catalogo, techniqueId } = useLocalSearchParams<{ catalogo?: string; techniqueId?: string }>();
  const existing = useTechnique(techniqueId);
  const list = useQuery({ queryKey: ["admin", "academies", "approved"], queryFn: () => api<AdminAcademyRow[]>("/admin/academies?status=approved") });
  if (list.isPending || (techniqueId && existing.isPending)) return <Loading />;
  if (!list.data) return <ErrorText error={list.error} />;
  const academies = [{ id: ROLAR, name: t.techniques.rolarCatalog }, ...list.data.map((a) => ({ id: a.id, name: a.name }))];
  return <TechniqueForm academies={academies} academyId={catalogo === ROLAR ? ROLAR : undefined} existing={existing.data} />;
}
