import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Printer from "lucide-react-native/icons/printer";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useState } from "react";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { useT } from "@/lib/i18n";
import { useAcademy } from "@/lib/queries";
import { Poster, PrintPoster } from "@/ui/qr-poster";
import { Button, Card, ErrorText, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

/**
 * The academy's check-in QR, made to be printed and left at the entrance (or shown on a tablet). It works
 * for every class: the app checks the student into whichever class is on when they scan.
 */
export default function AcademyQrScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const academy = useAcademy(id);
  const a = academy.data;
  const owner = a?.membership?.status === "active" && a.membership.role === "owner";
  const [error, setError] = useState<unknown>(null);

  async function rotate() {
    if (!a || !(await confirm(t.qr.rotateTitle, t.qr.rotateText, t.qr.rotateAction))) return;
    setError(null);
    try {
      await api(`/academies/${a.id}/checkin-qr/rotate`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["academy", a.id, "checkin-qr"] });
    } catch (e) {
      setError(e);
    }
  }

  if (academy.isPending) return <Loading />;
  if (!a) return <ErrorText error={academy.error} />;

  return (
    <>
      <Header
        title={t.academy.checkinQr}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/academia/${a.id}`))} />}
        right={Platform.OS === "web" ? <Button size="sm" icon={Printer} title={t.qr.print} onPress={() => window.print()} /> : undefined}
      />
      <Screen>
        <Poster academyId={a.id} name={a.name} />
        <PrintPoster academyId={a.id} name={a.name} />
        <Card style={{ gap: space.sm }}>
          <Txt bold>{t.qr.howTo}</Txt>
          <Txt v="small" muted>
            {t.qr.howToText}
          </Txt>
          {owner ? <Button size="sm" icon={RefreshCw} title={t.qr.rotate} onPress={rotate} style={{ alignSelf: "flex-start" }} /> : null}
          <ErrorText error={error} />
        </Card>
      </Screen>
    </>
  );
}
