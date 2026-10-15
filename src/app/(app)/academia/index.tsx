import { Redirect } from "expo-router";

import { useMe } from "@/lib/queries";
import { FindAcademy } from "@/ui/find-academy";

/** Opens the user's academy; without one, shows search and creation. */
export default function AcademyHome() {
  const me = useMe().data;
  const current = me?.profile?.homeAcademyId ?? me?.memberships[0]?.academy.id;
  if (current) return <Redirect href={`/academia/${current}`} />;
  return <FindAcademy />;
}
