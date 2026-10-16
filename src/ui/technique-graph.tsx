import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import Maximize from "lucide-react-native/icons/maximize";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, Marker, Path, Text as SvgText } from "react-native-svg";

import { useT } from "@/lib/i18n";
import type { TechniqueGraph } from "@/lib/types";

import { Badge, Button, Card, Col, Row, Txt } from "./kit";
import { CategoryDot } from "./techniques";
import { space, TECHNIQUE_COLORS, useTheme } from "./theme";

type GraphNode = TechniqueGraph["nodes"][number] & SimulationNodeDatum & { x: number; y: number; r: number; degree: number };
type View2D = { k: number; x: number; y: number };

const MIN_K = 0.2;
const MAX_K = 4;
/** Below this zoom only hubs (HUB links or more), and the selection with its neighbours, keep their names. */
const LABEL_K = 0.9;
const HUB = 4;
/** Maps this small show every name at any zoom. */
const FEW = 20;
/** SVG text does not inherit the app font; on the web the default would be a serif. */
const FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" : undefined;
/** A press that moves less than this (in screen pixels) is a tap. */
const TAP = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pointers = (e: GestureResponderEvent) => {
  const t = e.nativeEvent.touches;
  if (!t?.length) return { n: 1, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, spread: 0 };
  const [a, b] = t;
  return b
    ? { n: t.length, x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2, spread: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) }
    : { n: 1, x: a.pageX, y: a.pageY, spread: 0 };
};

/**
 * Force layout: linked techniques pull together, the rest spread out. Settled up front, then kept
 * (stopped) so dragging a dot can wake the physics and the others follow.
 */
function layout(graph: TechniqueGraph) {
  const degree = new Map<string, number>();
  for (const l of graph.links) for (const id of [l.from, l.to]) degree.set(id, (degree.get(id) ?? 0) + 1);
  const nodes = graph.nodes.map((n) => {
    const d = degree.get(n.id) ?? 0;
    // No x/y yet: d3 then seeds a phyllotaxis spiral (identical starts make the forces blow up).
    return { ...n, degree: d, r: 7 + Math.min(d, 8) * 1.3 } as GraphNode;
  });
  const links = graph.links.map((l) => ({ source: l.from, target: l.to }));
  const sim = forceSimulation(nodes)
    .force("link", forceLink<GraphNode, { source: string; target: string }>(links).id((n) => n.id).distance(60))
    .force("charge", forceManyBody().strength(-160))
    .force("collide", forceCollide<GraphNode>((n) => n.r + 16))
    // Weak gravity keeps techniques without links from drifting off.
    .force("x", forceX(0).strength(0.08))
    .force("y", forceY(0).strength(0.08))
    .stop()
    .tick(300);
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    sim,
    nodes,
    byId,
    links: graph.links
      .filter((l) => index.has(l.from) && index.has(l.to))
      .map((l) => ({ from: byId.get(l.from)!, to: byId.get(l.to)!, fi: index.get(l.from)!, ti: index.get(l.to)! })),
  };
}

/** Positions copied out of the simulation: render reads these, never the mutable d3 nodes. */
function snapshot(nodes: GraphNode[]) {
  return nodes.map((n) => ({ x: n.x, y: n.y }));
}

/**
 * Obsidian-style map of techniques: drag the background to pan, pinch / wheel / buttons to zoom,
 * drag a dot to pull it around (the linked ones follow), tap a dot to see the technique.
 */
export function TechniqueGraphView({
  graph,
  focus,
  onOpen,
  wheel = true,
}: {
  graph: TechniqueGraph;
  focus?: string;
  onOpen: (id: string) => void;
  /** Wheel zoom on the web; off when the map sits inside a scrolling page, so the wheel still scrolls. */
  wheel?: boolean;
}) {
  const t = useT();
  const { c } = useTheme();
  const g = useMemo(() => layout(graph), [graph]);
  // Positions tagged with the graph they belong to: a new graph renders its own layout until it moves.
  const [frame, setFrame] = useState(() => ({ g, pos: snapshot(g.nodes) }));
  const pos = frame.g === g ? frame.pos : snapshot(g.nodes);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View2D>({ k: 1, x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(focus ?? null);
  const live = useRef(view);
  const origin = useRef({ x: 0, y: 0 });
  // `drag`: the dot being moved, when the gesture started on one; otherwise the gesture pans/zooms.
  const start = useRef({ view, n: 0, x: 0, y: 0, spread: 0, moved: 0, drag: null as GraphNode | null });
  const box = useRef<View>(null);

  function apply(v: View2D) {
    live.current = { ...v, k: clamp(v.k, MIN_K, MAX_K) };
    setView(live.current);
  }

  /** Zooms by `factor` keeping the screen point (sx, sy) still. */
  function zoomAt(factor: number, sx: number, sy: number) {
    const v = live.current;
    const k = clamp(v.k * factor, MIN_K, MAX_K);
    apply({ k, x: sx - ((sx - v.x) * k) / v.k, y: sy - ((sy - v.y) * k) / v.k });
  }

  /** Fits every technique on screen, or centres on one. */
  function fit(w = size.w, h = size.h, on?: GraphNode) {
    if (!w || !h || !g.nodes.length) return;
    if (on) return apply({ k: 1.4, x: w / 2 - on.x * 1.4, y: h / 2 - on.y * 1.4 });
    const xs = g.nodes.map((n) => n.x);
    const ys = g.nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = clamp(Math.min(w / (x1 - x0 + 120), h / (y1 - y0 + 160)), MIN_K, 1.6);
    apply({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k });
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    const first = !size.w;
    setSize({ w, h });
    box.current?.measure((_x, _y, _w, _h, px, py) => (origin.current = { x: px, y: py }));
    if (first) fit(w, h, focus ? g.byId.get(focus) : undefined);
  }

  // While the physics runs (after a drag), every tick copies the positions into state.
  useEffect(() => {
    g.sim.on("tick", () => setFrame({ g, pos: snapshot(g.nodes) }));
    return () => {
      g.sim.on("tick", null);
      g.sim.stop();
    };
  }, [g]);

  // Mouse wheel zoom on the web (react-native-web has no wheel prop on View).
  useEffect(() => {
    if (Platform.OS !== "web" || !wheel) return;
    const el = box.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /** Screen (page) point to graph coordinates. */
  function toGraph(pageX: number, pageY: number) {
    const v = live.current;
    return { x: (pageX - origin.current.x - v.x) / v.k, y: (pageY - origin.current.y - v.y) / v.k };
  }

  /** The dot under a page point. Generous hit area on phones: the dot plus a finger's width. */
  function nodeAt(pageX: number, pageY: number) {
    const p = toGraph(pageX, pageY);
    const k = live.current.k;
    let hit: GraphNode | null = null;
    let best = Infinity;
    for (const n of g.nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < n.r + 14 / k && d < best) [hit, best] = [n, d];
    }
    return hit;
  }

  /** Lets go of the dragged dot: it rejoins the physics, which then cools down and stops. */
  function drop() {
    const n = start.current.drag;
    if (!n) return;
    n.fx = null;
    n.fy = null;
    g.sim.alphaTarget(0);
    start.current.drag = null;
  }

  function begin(e: GestureResponderEvent) {
    start.current = { ...start.current, view: live.current, ...pointers(e) };
  }
  function grant(e: GestureResponderEvent) {
    start.current.moved = 0;
    begin(e);
    const p = pointers(e);
    start.current.drag = p.n === 1 ? nodeAt(p.x, p.y) : null;
  }
  function move(e: GestureResponderEvent) {
    const p = pointers(e);
    // A second finger turns a drag into a pinch.
    if (p.n > 1) drop();
    if (p.n !== start.current.n) begin(e);
    const b = start.current;
    b.moved = Math.max(b.moved, Math.hypot(p.x - b.x, p.y - b.y));
    if (b.drag) {
      if (b.moved <= TAP) return;
      const at = toGraph(p.x, p.y);
      // Pin the dot under the finger and wake the physics so its links pull the others along.
      if (b.drag.fx == null) g.sim.alphaTarget(0.3).restart();
      b.drag.fx = at.x;
      b.drag.fy = at.y;
      return;
    }
    const k = p.spread && b.spread ? clamp((b.view.k * p.spread) / b.spread, MIN_K, MAX_K) : b.view.k;
    // The graph point under the gesture's start stays under the fingers.
    const sx = b.x - origin.current.x;
    const sy = b.y - origin.current.y;
    const gx = (sx - b.view.x) / b.view.k;
    const gy = (sy - b.view.y) / b.view.k;
    apply({ k, x: p.x - origin.current.x - gx * k, y: p.y - origin.current.y - gy * k });
  }
  function release(e: GestureResponderEvent) {
    const tap = start.current.moved <= TAP;
    drop();
    if (tap) setSelected(nodeAt(e.nativeEvent.pageX, e.nativeEvent.pageY)?.id ?? null);
  }

  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (selected) for (const l of g.links) if (l.from.id === selected || l.to.id === selected) set.add(l.from.id).add(l.to.id);
    return set;
  }, [g, selected]);
  const lit = (id: string) => !selected || id === selected || neighbours.has(id);
  const node = selected ? g.byId.get(selected) : undefined;
  const links = node ? g.links.filter((l) => l.from.id === node.id || l.to.id === node.id).length : 0;

  return (
    <View style={{ flex: 1 }}>
      <View
        ref={box}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={release}
        // Keep the gesture: otherwise the page or navigator takes over after the first move.
        onResponderTerminationRequest={() => false}
        onResponderTerminate={drop}
        // No text selection on the web while dragging dots or the background.
        style={{ flex: 1, overflow: "hidden", backgroundColor: c.bg, cursor: "grab", userSelect: "none" } as object}
      >
        {size.w ? (
          <Svg width={size.w} height={size.h} pointerEvents="none">
            <Defs>
              {[c.border, c.fg].map((color, i) => (
                <Marker key={color} id={`arrow${i}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <Path d="M0,0 L10,5 L0,10 z" fill={color} />
                </Marker>
              ))}
            </Defs>
            <G transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {g.links.map((l) => {
                const on = !!selected && (l.from.id === selected || l.to.id === selected);
                const a = pos[l.fi] ?? l.from;
                const z = pos[l.ti] ?? l.to;
                const dx = z.x - a.x;
                const dy = z.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                // Stop at the target's edge so the arrow head shows.
                return (
                  <Line
                    key={`${l.from.id}>${l.to.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={z.x - (dx / len) * (l.to.r + 2)}
                    y2={z.y - (dy / len) * (l.to.r + 2)}
                    stroke={on ? c.fg : c.border}
                    strokeOpacity={!selected || on ? 1 : 0.35}
                    strokeWidth={(on ? 2 : 1.25) / Math.sqrt(view.k)}
                    markerEnd={`url(#arrow${on ? 1 : 0})`}
                  />
                );
              })}
              {g.nodes.map((n, i) => {
                const { x, y } = pos[i] ?? n;
                return (
                <G key={n.id} opacity={lit(n.id) ? 1 : 0.2}>
                  <Circle cx={x} cy={y} r={n.r} fill={TECHNIQUE_COLORS[n.category]} stroke={n.id === selected ? c.fg : c.bg} strokeWidth={n.id === selected ? 3 : 1.5} />
                  {view.k >= LABEL_K || (selected ? lit(n.id) : g.nodes.length <= FEW || n.degree >= HUB) ? (
                    <SvgText x={x} y={y + n.r + 13 / view.k} fontSize={12 / view.k} fontFamily={FONT} fontWeight={n.id === selected ? "700" : "500"} fill={c.fg} textAnchor="middle">
                      {n.name}
                    </SvgText>
                  ) : null}
                </G>
                );
              })}
            </G>
          </Svg>
        ) : null}
      </View>

      <Col gap={6} style={{ position: "absolute", top: space.md, right: space.md }}>
        <Button size="sm" icon={Plus} accessibilityLabel={t.techniques.zoomIn} onPress={() => zoomAt(1.4, size.w / 2, size.h / 2)} />
        <Button size="sm" icon={Minus} accessibilityLabel={t.techniques.zoomOut} onPress={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)} />
        <Button size="sm" icon={Maximize} accessibilityLabel={t.techniques.fit} onPress={() => fit()} />
      </Col>

      {node ? (
        <Card style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: space.sm }}>
          <Row gap={space.sm}>
            <CategoryDot category={node.category} size={12} />
            <Txt v="h3" style={{ flex: 1 }} numberOfLines={1}>{node.name}</Txt>
          </Row>
          <Row wrap gap={6}>
            <Badge>{t.techniqueCategory[node.category]}</Badge>
            {node.position ? <Badge>{t.techniquePosition[node.position]}</Badge> : null}
            <Txt v="small" muted>{t.techniques.connections(links)}</Txt>
          </Row>
          <Button kind="primary" title={t.techniques.openDetails} onPress={() => onOpen(node.id)} />
        </Card>
      ) : null}
    </View>
  );
}
