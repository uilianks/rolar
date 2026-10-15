// The academy's check-in poster (screen and print share it).
import { View } from "react-native";

import { AcademyQr } from "./academy-qr";
import { Card, Row, Txt } from "./kit";
import { BrandMark } from "./shell";
import { space } from "./theme";

export function Poster({ academyId, name }: { academyId: string; name: string }) {
  return (
    <Card style={{ alignItems: "center", gap: space.lg, paddingVertical: space.xl }}>
      <Row>
        <BrandMark size={30} />
        <Txt v="h2" style={{ fontWeight: "800", letterSpacing: -0.6 }}>tatame</Txt>
      </Row>
      <Txt v="h1" style={{ textAlign: "center" }}>{name}</Txt>
      <AcademyQr academyId={academyId} size={300} />
      <View style={{ gap: 4, alignItems: "center" }}>
        <Txt v="h3" style={{ textAlign: "center" }}>Chegou? Faça check-in.</Txt>
        <Txt muted style={{ textAlign: "center" }}>Abra o tatame, toque em Check-in na barra de baixo e aponte para este código.</Txt>
      </View>
    </Card>
  );
}
