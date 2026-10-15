// Round timer: counts rounds and rest, then pre-fills "Registrar treino" with the duration and rounds.
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Flag from "lucide-react-native/icons/flag";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import SkipForward from "lucide-react-native/icons/skip-forward";
import { useEffect, useReducer, useRef, useState } from "react";
import { Platform, Vibration, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useT } from "@/lib/i18n";
import { prefs } from "@/lib/prefs";
import { Button, Card, Col, Kpi, Row, Segmented, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { useTheme } from "@/ui/theme";

const PRESETS = [
  { id: "5/1", round: 300, rest: 60 },
  { id: "6/1", round: 360, rest: 60 },
  { id: "10/2", round: 600, rest: 120 },
  { id: "3/1", round: 180, rest: 60 },
] as const;
type PresetId = (typeof PRESETS)[number]["id"];

const R = 52;
const CIRC = 2 * Math.PI * R;

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function beep() {
  if (Platform.OS === "web") {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // No audio available; the visual change still marks the round.
    }
  } else {
    Vibration.vibrate([0, 400, 200, 400]);
  }
}

type Phase = "round" | "rest";
type State = { phase: Phase; left: number; roundsDone: number; elapsed: number };
type Action = { type: "tick" | "skip" | "restart"; round: number; rest: number } | { type: "reset"; round: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return { phase: "round", left: a.round, roundsDone: 0, elapsed: 0 };
    case "restart":
      return { ...s, left: s.phase === "round" ? a.round : a.rest };
    case "tick":
      if (s.left > 1) return { ...s, left: s.left - 1, elapsed: s.elapsed + 1 };
      return next({ ...s, elapsed: s.elapsed + 1 }, a);
    case "skip":
      return next(s, a);
  }
}

/** Ends the current phase: a finished round counts and starts the rest, a finished rest starts a round. */
function next(s: State, a: { round: number; rest: number }): State {
  return s.phase === "round"
    ? { ...s, phase: "rest", left: a.rest, roundsDone: s.roundsDone + 1 }
    : { ...s, phase: "round", left: a.round };
}

export default function RoundTimer() {
  const t = useT();
  const { c } = useTheme();
  const [presetId, setPresetId] = useState<PresetId>("5/1");
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const [running, setRunning] = useState(false);
  const [state, dispatch] = useReducer(reducer, { phase: "round", left: preset.round, roundsDone: 0, elapsed: 0 });
  const { phase, left, roundsDone, elapsed } = state;
  const resting = phase === "rest";

  useEffect(() => {
    prefs.get("timer-preset").then((v) => {
      const p = PRESETS.find((x) => x.id === v);
      if (p) {
        setPresetId(p.id);
        dispatch({ type: "reset", round: p.round });
      }
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => dispatch({ type: "tick", round: preset.round, rest: preset.rest }), 1000);
    return () => clearInterval(id);
  }, [running, preset]);

  // Signal every phase change that happens while the timer runs.
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (phase !== lastPhase.current && running) beep();
    lastPhase.current = phase;
  }, [phase, running]);

  function choose(id: PresetId) {
    setPresetId(id);
    prefs.set("timer-preset", id);
    setRunning(false);
    dispatch({ type: "reset", round: PRESETS.find((x) => x.id === id)!.round });
  }

  function finish() {
    setRunning(false);
    const minutes = Math.max(15, Math.round(elapsed / 60 / 5) * 5);
    router.replace({ pathname: "/registrar", params: { durationMin: String(minutes), rounds: String(roundsDone), source: "timer" } });
  }

  const total = resting ? preset.rest : preset.round;
  const progress = left / total;
  const color = resting ? c.success : c.accent;

  return (
    <>
      <Header title={t.nav.timer} left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} />
      <Screen>
        <View style={{ maxWidth: 480, width: "100%", alignSelf: "center", gap: 20 }}>
          <View style={{ alignItems: "center" }}>
            <Segmented value={presetId} onChange={choose} options={PRESETS.map((p) => ({ value: p.id, label: p.id === "5/1" ? "5 min / 1 min" : p.id }))} />
          </View>

          <View style={{ width: 300, height: 300, alignSelf: "center" }}>
            <Svg width={300} height={300} viewBox="0 0 120 120" style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={60} cy={60} r={R} stroke={c.muted} strokeWidth={10} fill="none" />
              <Circle cx={60} cy={60} r={R} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
            </Svg>
            <Col gap={4} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Txt v="small" bold color={color}>{resting ? t.timer.rest : t.timer.roll}</Txt>
              <Txt style={{ fontSize: 64, lineHeight: 72, fontWeight: "700", letterSpacing: -2, fontVariant: ["tabular-nums"] }} accessibilityLiveRegion="polite">{mmss(left)}</Txt>
              <Txt muted>{t.timer.round(roundsDone + (resting ? 0 : 1))}</Txt>
            </Col>
          </View>

          <Row style={{ justifyContent: "center" }} gap={12}>
            <Button size="lg" icon={RotateCcw} accessibilityLabel={t.timer.restart} onPress={() => dispatch({ type: "restart", round: preset.round, rest: preset.rest })} />
            <Button kind="primary" size="lg" icon={running ? Pause : Play} title={running ? t.timer.pause : elapsed ? t.timer.resume : t.timer.start} onPress={() => setRunning(!running)} style={{ width: 140, height: 60, borderRadius: 999 }} />
            <Button size="lg" icon={SkipForward} accessibilityLabel={t.timer.skip} onPress={() => dispatch({ type: "skip", round: preset.round, rest: preset.rest })} />
          </Row>

          <Row gap={12}>
            <Kpi label={t.timer.totalTime} value={mmss(elapsed)} />
            <Kpi label={t.session.rounds} value={String(roundsDone)} />
          </Row>

          <Button size="lg" icon={Flag} title={t.timer.finish} onPress={finish} disabled={!elapsed} />
          <Card style={{ borderStyle: "dashed" }}>
            <Txt v="small" muted>{t.timer.hint}</Txt>
          </Card>
        </View>
      </Screen>
    </>
  );
}
