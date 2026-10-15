// Check-in by QR in one tap: the app scans the code itself, so the student never goes through the
// browser or has to sign in again. The QR holds the web URL /checkin?c=class&d=date&t=signature, which
// also works from the phone's own camera app as a fallback.
import { CameraView } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { endTime, isoWeekday } from "./format";
import { useClasses, useMe } from "./queries";
import { type CheckinCode, parseCheckin } from "./checkin-code";
import type { AcademyClass } from "./types";

function open(code: CheckinCode) {
  router.push({ pathname: "/checkin", params: code });
}

/**
 * Starts a scan. On Android and iOS this is the system code scanner (Google's on Android: no camera
 * permission prompt, closes itself after reading); elsewhere, the in-app camera screen.
 */
export function startCheckinScan() {
  if (Platform.OS === "web" || !CameraView.isModernBarcodeScannerAvailable) {
    router.push("/ler-qr");
    return;
  }
  const sub = CameraView.onModernBarcodeScanned((event) => {
    sub.remove();
    const code = parseCheckin(event.data);
    if (code) open(code);
    else router.push({ pathname: "/ler-qr", params: { invalid: "1" } });
  });
  CameraView.launchScanner({ barcodeTypes: ["qr"] }).catch(() => {
    sub.remove();
    router.push("/ler-qr");
  });
}

export function openScannedCheckin(data: string) {
  const code = parseCheckin(data);
  if (code) router.replace({ pathname: "/checkin", params: code });
  return !!code;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The class happening at the member's home academy right now (from 30 minutes before it starts until it
 * ends), so the check-in button shows up exactly when it is useful. Re-evaluated every minute.
 */
export function useClassNow(): { academyId: string; klass: AcademyClass; label: string } | null {
  const me = useMe().data;
  const academyId =
    me?.profile?.homeAcademyId ?? me?.memberships.find((m) => m.status === "active" && m.academy.status === "approved")?.academy.id ?? null;
  const classes = useClasses(academyId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!academyId || !classes.data) return null;
  const today = isoWeekday(now);
  const current = now.getHours() * 60 + now.getMinutes();
  const klass = classes.data.find((k) => k.weekday === today && current >= minutes(k.startTime) - 30 && current <= minutes(k.startTime) + k.durationMin);
  return klass ? { academyId, klass, label: `${klass.title} · ${klass.startTime}–${endTime(klass.startTime, klass.durationMin)}` } : null;
}
