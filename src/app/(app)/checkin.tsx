import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import CircleCheck from "lucide-react-native/icons/circle-check";
import { useEffect } from "react";

import { api } from "@/lib/api";
import { startCheckinScan } from "@/lib/checkin";
import { endTime } from "@/lib/format";
import { TZ } from "@/lib/queries";
import type { AcademyClass } from "@/lib/types";
import { Button, Card, Col, Empty, ErrorText, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space, useTheme } from "@/ui/theme";

type CheckinResult = { class: AcademyClass; academy: { id: string; name: string }; date: string };

/** Opened by the academy's QR (?a=academy&t=secret): checks in to the class on now, then offers to log it. */
export default function Checkin() {
  const { c } = useTheme();
  const { a: academyId, t: token } = useLocalSearchParams<{ a?: string; t?: string }>();
  // The phone's time zone is the academy's: the student is standing in it.
  const checkin = useMutation({ mutationFn: () => api<CheckinResult>("/checkin", { method: "POST", json: { a: academyId, t: token, tz: TZ } }) });
  const { mutate } = checkin;

  useEffect(() => {
    if (academyId && token) mutate();
  }, [academyId, token, mutate]);

  const r = checkin.data;
  return (
    <>
      <Header title="Check-in" />
      <Screen>
        {!academyId || !token ? <ErrorText error="Este link de check-in está incompleto. Leia o QR de novo." /> : null}
        {checkin.isPending ? <Loading /> : null}
        {checkin.error ? (
          <Card style={{ gap: space.md }}>
            <ErrorText error={checkin.error} />
            <Button title="Ler de novo" onPress={startCheckinScan} />
          </Card>
        ) : null}
        {r ? (
          <Card>
            <Empty icon={CircleCheck} title="Check-in feito!" text={`${r.class.title} · ${r.class.startTime}–${endTime(r.class.startTime, r.class.durationMin)} · ${r.academy.name}`} />
            <Col gap={space.sm}>
              <Txt v="small" color={c.mutedFg} style={{ textAlign: "center" }}>
                O professor confirma a sua presença na chamada. Bom treino!
              </Txt>
              <Button kind="primary" title="Registrar o treino desta aula" onPress={() => router.replace({ pathname: "/registrar", params: { classId: r.class.id, date: r.date } })} />
              <Button title="Ver a academia" onPress={() => router.replace(`/academia/${r.academy.id}`)} />
            </Col>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
