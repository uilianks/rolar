import { router } from "expo-router";
import Printer from "lucide-react-native/icons/printer";
import QrCode from "lucide-react-native/icons/qr-code";
import ScanLine from "lucide-react-native/icons/scan-line";
import { View } from "react-native";

import { startCheckinScan, useClassNow } from "@/lib/checkin";
import { ymd } from "@/lib/format";
import { useMe } from "@/lib/queries";

import { Button, Card, Row, Txt } from "./kit";
import { space, useTheme } from "./theme";

/**
 * Shown only while a class is on at the member's academy. Students: one tap opens the scanner and the
 * check-in happens as soon as the QR is read. Staff: one tap shows the QR for that class.
 */
export function ClassNowCard() {
  const { c } = useTheme();
  const now = useClassNow();
  const me = useMe().data;
  if (!now) return null;
  const role = me?.memberships.find((m) => m.academy.id === now.academyId && m.status === "active")?.role;
  const staff = role === "owner" || role === "coach";
  return (
    <Card style={{ borderColor: c.accent, borderWidth: 1.5, gap: space.md }}>
      <Row style={{ justifyContent: "space-between" }} wrap>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Txt v="tiny" bold color={c.accent}>AULA AGORA</Txt>
          <Txt v="h3">{now.label}</Txt>
        </View>
      </Row>
      {staff ? (
        <Button
          kind="primary"
          size="lg"
          icon={QrCode}
          title="Mostrar QR de check-in"
          onPress={() => router.push(`/academia/${now.academyId}/chamada?classId=${now.klass.id}&date=${ymd(new Date())}&qr=1`)}
        />
      ) : null}
      {staff ? (
        <Button
          icon={Printer}
          title="QR para imprimir na entrada"
          onPress={() => router.push(`/academia/${now.academyId}/qr`)}
        />
      ) : null}
      {!staff ? <Button kind="primary" size="lg" icon={ScanLine} title="Fazer check-in" onPress={startCheckinScan} /> : null}
    </Card>
  );
}
