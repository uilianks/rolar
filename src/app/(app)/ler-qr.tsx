import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Camera from "lucide-react-native/icons/camera";
import { useState } from "react";
import { View } from "react-native";

import { openScannedCheckin } from "@/lib/checkin";
import { useT } from "@/lib/i18n";
import { Button, Card, Empty, Loading, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { radius, space, useTheme } from "@/ui/theme";

/** In-app QR reader (web, or when the system scanner is unavailable): reading the code checks in at once. */
export default function ReadQr() {
  const t = useT();
  const { c } = useTheme();
  const { invalid } = useLocalSearchParams<{ invalid?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [wrong, setWrong] = useState(invalid === "1");
  const [done, setDone] = useState(false);

  return (
    <>
      <Header
        title={t.nav.checkin}
        left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
      <Screen>
        {!permission ? <Loading /> : null}
        {permission && !permission.granted ? (
          <Card>
            <Empty
              icon={Camera}
              title={t.checkin.pointTitle}
              text={t.checkin.cameraText}
              action={<Button kind="primary" title={permission.canAskAgain ? t.checkin.openCamera : t.checkin.allowInSettings} onPress={requestPermission} />}
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
            <Txt muted style={{ textAlign: "center" }}>{t.checkin.pointHint}</Txt>
          </View>
        ) : null}
        {wrong ? (
          <Txt v="small" color={c.accent} style={{ textAlign: "center" }}>
            {t.checkin.wrongQr}
          </Txt>
        ) : null}
      </Screen>
    </>
  );
}
