import { useLocalSearchParams } from "expo-router";

import { useAcademy, useStaffAcademies, useTechnique } from "@/lib/queries";
import { Loading } from "@/ui/kit";
import { TechniqueForm } from "@/ui/technique-form";

/** Create a technique for the academy, or edit one (`?techniqueId=`). Staff and admins; the API enforces it. */
export default function TechniqueFormScreen() {
  const { id, techniqueId } = useLocalSearchParams<{ id: string; techniqueId?: string }>();
  const existing = useTechnique(techniqueId);
  const staffAt = useStaffAcademies();
  const academy = useAcademy(id).data;
  if (techniqueId && existing.isPending) return <Loading />;
  // An admin who is not staff here adds to this academy only (the one in the URL).
  const academies = staffAt.some((a) => a.id === id) ? staffAt : [{ id, name: academy?.name ?? "" }];
  return <TechniqueForm academyId={id} existing={existing.data} academies={academies} />;
}
