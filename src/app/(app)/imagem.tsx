import { router, useLocalSearchParams } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ImageIcon from "lucide-react-native/icons/image";
import Share2 from "lucide-react-native/icons/share-2";
import X from "lucide-react-native/icons/x";
import ZoomIn from "lucide-react-native/icons/zoom-in";
import ZoomOut from "lucide-react-native/icons/zoom-out";
import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";

import { pickImage } from "@/lib/avatar";
import { dateFmt, duration } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useMe, useSession, useWeek } from "@/lib/queries";
import { renderStory, shareStory, type StoryCard, type StoryPhoto, storySupported } from "@/lib/story-image";
import type { SessionDetail, WeekReport } from "@/lib/types";
import { Button, Card, ErrorText, Loading, Row, SwitchRow, Txt } from "@/ui/kit";
import { Header, Screen } from "@/ui/shell";
import { space } from "@/ui/theme";

type T = ReturnType<typeof useT>;

const day = (iso: string) => dateFmt({ day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
const dayUtc = (ymd: string) => dateFmt({ day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
const letterUtc = (ymd: string) => dateFmt({ weekday: "narrow", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const finishes = (list: { name: string; count: number }[]) => list.map((f) => (f.count > 1 ? `${f.name} ×${f.count}` : f.name)).join(", ");

function sessionCard(t: T, s: SessionDetail, extra: boolean): StoryCard {
  const stats = [
    { label: t.story.time, value: duration(s.durationMin) },
    { label: t.session.rounds, value: String(s.rounds) },
  ];
  if (s.rpe) stats.push({ label: t.story.intensity, value: `${s.rpe}/10` });
  return {
    eyebrow: `${t.sessionKind[s.kind]} · ${day(s.startedAt)}`,
    title: s.title || t.sessionTitle(t.sessionKind[s.kind]),
    stats,
    footnote: extra && s.submissions.length ? t.story.submissions(finishes(s.submissions)) : undefined,
    athlete: { name: s.author.name, belt: s.author.belt },
  };
}

function weekCard(t: T, r: WeekReport, athlete: StoryCard["athlete"], extra: boolean): StoryCard {
  const cur = r.current;
  return {
    eyebrow: t.story.week(t.week.range(dayUtc(r.week), dayUtc(addDays(r.week, 6)))),
    title: t.week.sessions(cur.sessions),
    stats: [
      { label: t.story.time, value: duration(cur.minutes) },
      { label: t.session.rounds, value: String(cur.rounds) },
      { label: t.finishes.title, value: String(cur.submissions.total) },
    ],
    days: Array.from({ length: 7 }, (_, i) => addDays(r.week, i)).map((d) => ({ letter: letterUtc(d), on: cur.days.includes(d) })),
    footnote: extra && r.goal ? (r.goalMet ? `${t.week.goalMet(r.goal)}${r.streakWeeks > 1 ? ` · ${t.week.streak(r.streakWeeks)}` : ""}` : t.week.goalMissed(cur.sessions, r.goal)) : undefined,
    athlete,
  };
}

/** Story frame for one of the athlete's sessions (`?treino=`) or weeks (`?semana=`), with their own photo. */
export default function StoryScreen() {
  const t = useT();
  const { treino, semana } = useLocalSearchParams<{ treino?: string; semana?: string }>();
  const me = useMe().data;
  const session = useSession(treino ?? "");
  const week = useWeek(semana);
  const [extra, setExtra] = useState(true);

  const card = useMemo(() => {
    if (treino) return session.data && session.data.author.id === me?.user.id ? sessionCard(t, session.data, extra) : null;
    const p = me?.profile;
    return week.data && p ? weekCard(t, week.data, { name: p.name, belt: p.belt }, extra) : null;
  }, [t, treino, session.data, week.data, me, extra]);

  const pending = treino ? session.isPending : week.isPending;
  const back = () => (router.canGoBack() ? router.back() : router.replace(treino ? `/treino/${treino}` : "/semana"));

  return (
    <>
      <Header title={t.story.title} left={<Button kind="ghost" icon={ArrowLeft} accessibilityLabel={t.common.back} onPress={back} />} />
      <Screen>
        {!storySupported ? (
          <Card>
            <Txt muted>{t.story.webOnly}</Txt>
          </Card>
        ) : pending ? (
          <Loading />
        ) : card ? (
          <Editor card={card} extraLabel={treino ? t.story.showSubmissions : t.story.showGoal} extra={extra} setExtra={setExtra} fileName={treino ? "rolar-treino.png" : "rolar-semana.png"} />
        ) : (
          <ErrorText error={session.error ?? week.error ?? t.story.notYours} />
        )}
      </Screen>
    </>
  );
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function Editor({ card, extraLabel, extra, setExtra, fileName }: { card: StoryCard; extraLabel: string; extra: boolean; setExtra: (v: boolean) => void; fileName: string }) {
  const t = useT();
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [boxW, setBoxW] = useState(1);

  // Redraw the preview when anything changes; a newer drawing wins over a slower older one.
  useEffect(() => {
    let live = true;
    renderStory(card, photo, true)
      .then((uri) => live && setPreview(uri))
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [card, photo]);

  // Dragging the preview slides the photo inside the frame (pointer events: mouse and touch).
  const [dragFrom, setDragFrom] = useState<{ px: number; py: number; x: number; y: number } | null>(null);
  function dragTo(px: number, py: number) {
    if (!dragFrom || !photo) return;
    const half = boxW / 2;
    setPhoto({ ...photo, x: clamp(dragFrom.x + (px - dragFrom.px) / half), y: clamp(dragFrom.y + ((py - dragFrom.py) / half) * (9 / 16)) });
  }

  async function choose() {
    const picked = await pickImage();
    if (picked) setPhoto({ src: picked.uri, zoom: 1, x: 0, y: 0 });
  }

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const full = await renderStory(card, photo);
      const how = await shareStory(full, fileName);
      if (how === "downloaded") setNote(t.story.downloaded);
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  const zoom = (d: number) => photo && setPhoto({ ...photo, zoom: Math.max(1, Math.min(3, photo.zoom + d)) });

  return (
    <>
      <View
        onPointerDown={(e) => photo && setDragFrom({ px: e.nativeEvent.pageX, py: e.nativeEvent.pageY, x: photo.x, y: photo.y })}
        onPointerMove={(e) => dragTo(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onPointerUp={() => setDragFrom(null)}
        onPointerLeave={() => setDragFrom(null)}
        onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
        style={{ width: "100%", maxWidth: 360, alignSelf: "center", aspectRatio: 9 / 16, borderRadius: 16, overflow: "hidden", backgroundColor: "#0a0a0a", cursor: photo ? "grab" : undefined, touchAction: "none" } as object}
      >
        {preview ? <View pointerEvents="none" style={{ flex: 1 }}><Image source={{ uri: preview }} accessibilityLabel={t.story.preview} style={{ width: "100%", height: "100%" }} /></View> : <Loading />}
      </View>
      {photo ? <Txt v="small" muted style={{ textAlign: "center" }}>{t.story.dragHint}</Txt> : null}

      <Row wrap gap={space.sm} style={{ justifyContent: "center" }}>
        <Button icon={ImageIcon} title={photo ? t.story.changePhoto : t.story.choosePhoto} onPress={choose} />
        {photo ? (
          <>
            <Button icon={ZoomOut} accessibilityLabel={t.story.zoomOut} onPress={() => zoom(-0.25)} disabled={photo.zoom <= 1} />
            <Button icon={ZoomIn} accessibilityLabel={t.story.zoomIn} onPress={() => zoom(0.25)} disabled={photo.zoom >= 3} />
            <Button kind="ghost" icon={X} title={t.story.noPhoto} onPress={() => setPhoto(null)} />
          </>
        ) : null}
      </Row>

      <SwitchRow title={extraLabel} value={extra} onChange={setExtra} />
      <ErrorText error={error} />
      <Button kind="primary" size="lg" icon={Share2} title={t.story.share} loading={busy} onPress={share} />
      {note ? <Txt v="small" muted style={{ textAlign: "center" }}>{note}</Txt> : null}
      <Txt v="small" muted style={{ textAlign: "center" }}>{t.story.privacy}</Txt>
    </>
  );
}
