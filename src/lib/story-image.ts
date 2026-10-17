// Instagram story frame (1080×1920): the athlete's photo with the session's or week's numbers drawn
// at the bottom. Drawn on a browser canvas, so it works on the web only for now; the image is made on
// the device and never uploaded.
import { Platform } from "react-native";

import type { Belt } from "@/shared/domain";
import { BELT_COLORS } from "@/ui/theme";

export const STORY_W = 1080;
export const STORY_H = 1920;

export const storySupported = Platform.OS === "web" && typeof document !== "undefined";

export type StoryCard = {
  /** Small caps line above the title: "GI · 17 OUT 2026". */
  eyebrow: string;
  title: string;
  stats: { label: string; value: string }[];
  /** Week only: one letter per day, filled when trained. */
  days?: { letter: string; on: boolean }[];
  /** One extra line (submissions, goal). */
  footnote?: string;
  athlete: { name: string; belt: Belt };
};

/** `zoom` ≥ 1 enlarges the photo past "cover"; `x` and `y` (−1…1) slide it inside the frame. */
export type StoryPhoto = { src: string; zoom: number; x: number; y: number };

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ACCENT = "#ef4444";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** Cuts `text` with "…" so it fits in `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** The app mark: "r" over a red bar, then the name. */
function brand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const s = 84;
  ctx.fillStyle = "#18181b";
  roundRect(ctx, x, y, s, s, s * 0.27);
  ctx.fillStyle = "#fafafa";
  ctx.font = `800 ${s * 0.56}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("r", x + s / 2, y + s * 0.6);
  ctx.fillStyle = ACCENT;
  roundRect(ctx, x + s * 0.33, y + s * 0.7, s * 0.34, s * 0.08, 3);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${s * 0.5}px ${FONT}`;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 12;
  ctx.fillText("Rolar", x + s + 22, y + s * 0.66);
  ctx.shadowBlur = 0;
}

/** `preview`: half size and JPEG, fast enough to redraw while the photo is dragged. */
export async function renderStory(card: StoryCard, photo: StoryPhoto | null, preview = false): Promise<string> {
  const scale = preview ? 0.5 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W * scale;
  canvas.height = STORY_H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background: the photo, "cover" fitted then zoomed and slid; without one, dark with a red glow.
  if (photo) {
    const img = await loadImage(photo.src);
    const scale = Math.max(STORY_W / img.width, STORY_H / img.height) * Math.max(1, photo.zoom);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (STORY_W - w) / 2 + ((w - STORY_W) / 2) * photo.x;
    const y = (STORY_H - h) / 2 + ((h - STORY_H) / 2) * photo.y;
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    const glow = ctx.createRadialGradient(STORY_W * 0.8, STORY_H * 0.25, 0, STORY_W * 0.8, STORY_H * 0.25, STORY_W);
    glow.addColorStop(0, "rgba(239,68,68,0.45)");
    glow.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  // Shades so white text reads on any photo: a light one at the top, a deep one at the bottom.
  const top = ctx.createLinearGradient(0, 0, 0, 320);
  top.addColorStop(0, "rgba(0,0,0,0.45)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, STORY_W, 320);
  const bottom = ctx.createLinearGradient(0, STORY_H * 0.45, 0, STORY_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(0.45, "rgba(0,0,0,0.72)");
  bottom.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, STORY_H * 0.45, STORY_W, STORY_H * 0.55);

  brand(ctx, 72, 96);

  // Bottom block, laid out upwards from the footer.
  const left = 80;
  const width = STORY_W - left * 2;
  let y = STORY_H - 120;

  // Footer: belt colour and the athlete's name, "rolar.app" on the right.
  ctx.fillStyle = BELT_COLORS[card.athlete.belt];
  roundRect(ctx, left, y - 30, 64, 22, 6);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 36px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(fit(ctx, card.athlete.name, width - 320), left + 84, y - 8);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText("rolar.app", STORY_W - left, y - 8);
  ctx.textAlign = "left";
  y -= 90;

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(left, y, width, 2);
  y -= 50;

  if (card.footnote) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(fit(ctx, card.footnote, width), left, y);
    y -= 80;
  }

  if (card.days) {
    const gap = 16;
    const box = (width - gap * 6) / 7;
    card.days.forEach((d, i) => {
      const x = left + i * (box + gap);
      ctx.fillStyle = d.on ? ACCENT : "rgba(255,255,255,0.16)";
      roundRect(ctx, x, y - 96, box, 64, 14);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `600 28px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(d.letter, x + box / 2, y);
      ctx.textAlign = "left";
    });
    y -= 150;
  }

  // Stats: value large, label small, in equal columns.
  const col = width / card.stats.length;
  card.stats.forEach((s, i) => {
    const x = left + i * col;
    ctx.fillStyle = "#fff";
    // Shrink long values ("1h 30min") to fit their column instead of cutting them.
    let size = 76;
    do ctx.font = `800 ${size}px ${FONT}`;
    while (ctx.measureText(s.value).width > col - 24 && (size -= 4) >= 40);
    ctx.fillText(fit(ctx, s.value, col - 24), x, y);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(s.label.toUpperCase(), x, y - 92);
  });
  y -= 190;

  ctx.fillStyle = "#fff";
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(fit(ctx, card.title, width), left, y);
  y -= 110;

  ctx.fillStyle = ACCENT;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(card.eyebrow.toUpperCase(), left, y);

  return preview ? canvas.toDataURL("image/jpeg", 0.85) : canvas.toDataURL("image/png");
}

/** The browser's share sheet with the image when it can share files (phones); a download otherwise. */
export async function shareStory(dataUrl: string, fileName: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared" as const;
    } catch (e) {
      // Closing the share sheet is not an error.
      if (e instanceof Error && e.name === "AbortError") return "cancelled" as const;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded" as const;
}
