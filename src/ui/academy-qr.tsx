import { useQuery } from "@tanstack/react-query";
import { Platform, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/auth-client";
import { checkinUrl } from "@/lib/checkin-code";

import { ErrorText, Loading } from "./kit";
import { radius, space } from "./theme";

export type AcademyQrData = { academyId: string; name: string; token: string };

export function useAcademyQr(academyId: string) {
  return useQuery({ queryKey: ["academy", academyId, "checkin-qr"], queryFn: () => api<AcademyQrData>(`/academies/${academyId}/checkin-qr`) });
}

/** The academy's permanent check-in QR (always black on white, so it scans in any theme or on paper). */
export function AcademyQr({ academyId, size = 260 }: { academyId: string; size?: number }) {
  const qr = useAcademyQr(academyId);
  // Web: the site serving the app; Android: the production site that serves the same app.
  const origin = Platform.OS === "web" ? window.location.origin : API_URL;
  if (qr.isPending) return <Loading />;
  if (!qr.data) return <ErrorText error={qr.error} />;
  return (
    <View style={{ padding: space.lg, backgroundColor: "#fff", borderRadius: radius.md }}>
      <QRCode value={checkinUrl(origin, { a: qr.data.academyId, t: qr.data.token })} size={size} />
    </View>
  );
}
