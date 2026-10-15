// Shown on the sign-in screen: a phone, turned in perspective, cycling through real app screens with a caption
// for each, so someone about to sign up sees what is inside. Beside the form on wide screens; on narrow ones a
// smaller phone above the form, fading out into the page at the bottom. Advances on its own
// every few seconds, unless motion is reduced or the person has picked a screen (dots, or tapping the phone).
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useT } from "@/lib/i18n";
import { Col, Row, Txt } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

// Screenshots taken at 390x844 (scripts in video/), resized to 360px wide.
const SCREENS = [
  { key: "feed", src: require("../../assets/images/previews/feed.webp") },
  { key: "log", src: require("../../assets/images/previews/registrar.webp") },
  { key: "progress", src: require("../../assets/images/previews/progresso.webp") },
  { key: "academy", src: require("../../assets/images/previews/al-academia.webp") },
  { key: "teacher", src: require("../../assets/images/previews/prof-chamada.webp") },
  { key: "timer", src: require("../../assets/images/previews/timer.webp") },
] as const;

const EVERY_MS = 4000;
/** Height of the compact phone's window; its last `COMPACT_FADE` points fade into the page. */
const COMPACT_VISIBLE = 230;
const COMPACT_FADE = 110;
const TURN = [{ perspective: 1400 }, { rotateY: "-22deg" }, { rotateX: "8deg" }, { rotateZ: "4deg" }] as const;
const TURN_COMPACT = [{ perspective: 1400 }, { rotateY: "-12deg" }, { rotateX: "6deg" }, { rotateZ: "3deg" }] as const;

function Phone({ width, src, label, compact, onPress }: { width: number; src: number; label: string; compact?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const scale = width / 270;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      aria-label={label}
      style={{
        padding: 10 * scale,
        borderRadius: 44 * scale,
        backgroundColor: "#18181b",
        borderWidth: 1,
        borderColor: c.border,
        transform: [...(compact ? TURN_COMPACT : TURN)],
        boxShadow: compact ? "-10px 16px 28px rgba(0,0,0,0.16)" : "-30px 40px 60px rgba(0,0,0,0.22)",
      }}
    >
      <Image
        source={src}
        transition={450}
        style={{ width, height: Math.round((width * 844) / 390), borderRadius: 34 * scale, backgroundColor: c.muted }}
        contentFit="cover"
      />
    </Pressable>
  );
}

function Fade() {
  const { c } = useTheme();
  return (
    <Svg pointerEvents="none" width="100%" height={COMPACT_FADE} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <LinearGradient id="showcase-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
          <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#showcase-fade)" />
    </Svg>
  );
}

function Dots({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const { c } = useTheme();
  const t = useT();
  return (
    <Row gap={6} style={{ justifyContent: "center" }}>
      {SCREENS.map((s, i) => (
        <Pressable
          key={s.key}
          role="button"
          aria-label={t.signIn.showcase.goTo(i + 1)}
          aria-selected={i === index}
          hitSlop={8}
          onPress={() => onPick(i)}
          style={{ width: i === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? c.fg : c.border }}
        />
      ))}
    </Row>
  );
}

export function AppShowcase({ compact }: { compact?: boolean }) {
  const t = useT();
  const still = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (still || picked) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SCREENS.length), EVERY_MS);
    return () => clearInterval(id);
  }, [still, picked]);

  const pick = (i: number) => {
    setPicked(true);
    setIndex(i);
  };
  const screen = SCREENS[index];
  const caption = t.signIn.showcase[screen.key];

  if (compact) {
    return (
      <Col gap={space.md} style={{ alignItems: "center" }} aria-label={t.signIn.showcase.label}>
        <Col gap={2} style={{ alignItems: "center", minHeight: 44 }}>
          <Txt bold style={{ textAlign: "center" }}>{caption.title}</Txt>
          <Txt v="small" muted style={{ textAlign: "center" }}>{caption.body}</Txt>
        </Col>
        <Dots index={index} onPick={pick} />
        <View style={{ height: COMPACT_VISIBLE, width: "100%", alignItems: "center", overflow: "hidden", paddingTop: space.md }}>
          <Phone width={210} src={screen.src} label={caption.title} compact onPress={() => pick((index + 1) % SCREENS.length)} />
          <Fade />
        </View>
      </Col>
    );
  }

  return (
    <Col gap={space.xl} style={{ width: 340, alignItems: "center" }} aria-label={t.signIn.showcase.label}>
      {/* The turn pushes corners past the layout box; keep them off the caption. */}
      <View style={{ marginVertical: space.xl }}>
        <Phone width={270} src={screen.src} label={caption.title} />
      </View>
      {/* Fixed height so the dots do not jump between one- and two-line captions. */}
      <Col gap={4} style={{ alignItems: "center", minHeight: 72 }}>
        <Txt v="h3" style={{ textAlign: "center" }}>{caption.title}</Txt>
        <Txt muted style={{ textAlign: "center" }}>{caption.body}</Txt>
      </Col>
      <Dots index={index} onPick={pick} />
    </Col>
  );
}
