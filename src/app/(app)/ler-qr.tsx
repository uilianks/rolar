import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Camera from "lucide-react-native/icons/camera";
import { useState } from "react";
import { View } from "react-native";

import { openScannedCheckin } from "@/lib/checkin";
import { Button, Card, Empty, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { radius, space, useTheme } from "@/ui/theme";

/** In-app QR reader (web, or when the system scanner is unavailable): reading the code checks in at once. */
export default function ReadQr() {
  const { c } = useTheme();
  const { invalid } = useLocalSearchParams<{ invalid?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [wrong, setWrong] = useState(invalid === "1");
  const [done, setDone] = useState(false);

  return (
    <>
      <Header
        title="Check-in"
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <Screen>
        {!permission ? <Loading /> : null}
        {permission && !permission.granted ? (
          <Card>
            <Empty
              icon={Camera}
              title="Aponte para o QR da aula"
              text="O tatame usa a câmara só para ler o código. Nada é gravado."
              action={<Button kind="primary" title={permission.canAskAgain ? "Abrir a câmara" : "Permitir nas configurações"} onPress={requestPermission} />}
            />
          </Card>
        ) : null}
        {permission?.granted ? (
          <View style={{ gap: space.md }}>
            <View style={{ borderRadius: radius.lg, overflow: "hidden", aspectRatio: 1, backgroundColor: "#000" }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={
                  done
                    ? undefined
                    : ({ data }) => {
                        if (openScannedCheckin(data)) setDone(true);
                        else setWrong(true);
                      }
                }
              />
            </View>
            <Txt muted style={{ textAlign: "center" }}>Aponte para o QR que o professor mostra. O check-in acontece sozinho.</Txt>
          </View>
        ) : null}
        {wrong ? (
          <Txt v="small" color={c.accent} style={{ textAlign: "center" }}>
            Esse QR não é de check-in do tatame.
          </Txt>
        ) : null}
      </Screen>
    </>
  );
}
