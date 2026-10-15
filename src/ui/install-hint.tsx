import Download from "lucide-react-native/icons/download";
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical";
import Share from "lucide-react-native/icons/share";
import Smartphone from "lucide-react-native/icons/smartphone";
import SquarePlus from "lucide-react-native/icons/square-plus";
import X from "lucide-react-native/icons/x";
import type { LucideIcon } from "lucide-react-native";
import { useState, useSyncExternalStore } from "react";
import { Platform, Pressable, View } from "react-native";

import { useT } from "@/lib/i18n";

import { Button, Card, Col, Row, Txt } from "./kit";
import { radius, space, useTheme } from "./theme";

// "Install the app" card for the mobile web (the site is a PWA, see public/manifest.json). Hidden on
// the native app, on desktop, when already opened from the home screen, and after "Agora não".

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Device = "android" | "ios";

const DISMISS_KEY = "rolar_install_hint_dismissed";
const isWeb = Platform.OS === "web" && typeof window !== "undefined";

// Chrome fires beforeinstallprompt once, possibly before this screen mounts, so it is kept here and read
// through useSyncExternalStore. No preventDefault: Chrome can still show its own banner on other screens.
let installPrompt: InstallPromptEvent | null = null;
let installed = false;
const subscribers = new Set<() => void>();
if (isWeb) {
  window.addEventListener("beforeinstallprompt", (e) => {
    installPrompt = e as InstallPromptEvent;
    subscribers.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", setInstalled);
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => void subscribers.delete(fn);
}

function setInstalled() {
  installed = true;
  installPrompt = null;
  subscribers.forEach((fn) => fn());
}

function detectDevice(): Device | null {
  if (!isWeb) return null;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch tells them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallHint() {
  const { c } = useTheme();
  const t = useT();
  const [device] = useState(detectDevice);
  const [hidden, setHidden] = useState(wasDismissed);
  const prompt = useSyncExternalStore(subscribe, () => installPrompt, () => null);
  const done = useSyncExternalStore(subscribe, () => installed, () => false);

  if (!device || hidden || done) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: hidden for this visit only.
    }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    // The event can be used once; accepted → done, dismissed → back to the manual steps.
    if ((await prompt.userChoice).outcome === "accepted") return setInstalled();
    installPrompt = null;
    subscribers.forEach((fn) => fn());
  }

  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
          <Smartphone size={20} color={c.fg} />
        </View>
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="h3">{t.install.title}</Txt>
          <Txt v="small" muted>{t.install.text}</Txt>
        </Col>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel={t.install.notNow} hitSlop={10}>
          <X size={18} color={c.mutedFg} />
        </Pressable>
      </Row>

      {device === "android" ? (
        prompt ? (
          <Button kind="primary" icon={Download} title={t.install.install} onPress={install} />
        ) : (
          <Steps
            label="Android"
            steps={[
              { icon: EllipsisVertical, text: t.install.android1 },
              { icon: Download, text: t.install.android2 },
            ]}
          />
        )
      ) : (
        <Steps
          label={t.install.ios}
          steps={[
            { icon: Share, text: t.install.ios1 },
            { icon: SquarePlus, text: t.install.ios2 },
          ]}
          note={t.install.iosNote}
        />
      )}
    </Card>
  );
}

function Steps({ label, steps, note }: { label: string; steps: { icon: LucideIcon; text: string }[]; note?: string }) {
  const { c } = useTheme();
  return (
    <Col gap={space.sm}>
      <Txt v="tiny" bold muted style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Txt>
      {steps.map(({ icon: Icon, text }, i) => (
        <Row key={text} style={{ alignItems: "center" }}>
          <Txt v="small" bold style={{ width: 16 }}>{i + 1}.</Txt>
          <Icon size={18} color={c.fg} />
          <Txt v="small" style={{ flex: 1 }}>{text}</Txt>
        </Row>
      ))}
      {note ? <Txt v="tiny" muted>{note}</Txt> : null}
    </Col>
  );
}
