import { Image } from "expo-image";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import { useRef, useState } from "react";
import { Modal, useWindowDimensions, View, type GestureResponderEvent } from "react-native";

import type { CropRect, PickedImage } from "@/lib/avatar";

import { Button, Row, Txt } from "./kit";
import { radius, space, useTheme } from "./theme";

const MAX_ZOOM = 4;
const STEP = 1.25;

type Framing = { zoom: number; x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Where the fingers are: their centre and, with two, how far apart. A mouse has no touches. */
const pointers = (e: GestureResponderEvent) => {
  const t = e.nativeEvent.touches;
  if (!t?.length) return { n: 1, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, spread: 0 };
  const [a, b] = t;
  return b
    ? { n: t.length, x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2, spread: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) }
    : { n: 1, x: a.pageX, y: a.pageY, spread: 0 };
};

/**
 * Lets the person drag and zoom (pinch, or −/+) the photo inside the circle before it is saved.
 * The image starts covering the frame; `zoom` multiplies that, and the offset is kept so the frame
 * never shows empty space.
 */
export function AvatarCropper({ image, onCancel, onDone }: { image: PickedImage; onCancel: () => void; onDone: (rect: CropRect) => void }) {
  const { c } = useTheme();
  const frame = Math.min(useWindowDimensions().width - space.xl * 2, 320);
  const cover = frame / Math.min(image.width, image.height);
  const [view, setView] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  // The latest view, for the gesture handlers (they run outside render).
  const live = useRef(view);
  // Gesture baseline: the view and finger spread when the gesture (or a second finger) started.
  const start = useRef({ view, n: 0, x: 0, y: 0, spread: 0 });

  // Keeps the image over the whole frame at this zoom.
  function apply(v: Framing) {
    const zoom = clamp(v.zoom, 1, MAX_ZOOM);
    const maxX = (image.width * cover * zoom - frame) / 2;
    const maxY = (image.height * cover * zoom - frame) / 2;
    live.current = {
      zoom,
      x: clamp(v.x, -maxX, maxX),
      y: clamp(v.y, -maxY, maxY),
    };
    setView(live.current);
  }

  // Raw responder events (not PanResponder): drag with one finger or the mouse, pinch with two.
  // Moving the centre of the fingers drags, so a pinch can also reposition the photo.
  function begin(e: GestureResponderEvent) {
    start.current = { view: live.current, ...pointers(e) };
  }
  function move(e: GestureResponderEvent) {
    const p = pointers(e);
    // A finger was added or lifted: restart from here so the image does not jump.
    if (p.n !== start.current.n) begin(e);
    const b = start.current;
    apply({ zoom: p.spread && b.spread ? (b.view.zoom * p.spread) / b.spread : b.view.zoom, x: b.view.x + p.x - b.x, y: b.view.y + p.y - b.y });
  }

  const scale = cover * view.zoom;
  const width = image.width * scale;
  const height = image.height * scale;

  function done() {
    // The frame in image pixels: its side, and its centre shifted back by the drag.
    const side = frame / scale;
    const cx = image.width / 2 - view.x / scale;
    const cy = image.height / 2 - view.y / scale;
    onDone({
      originX: clamp(Math.round(cx - side / 2), 0, image.width - Math.floor(side)),
      originY: clamp(Math.round(cy - side / 2), 0, image.height - Math.floor(side)),
      size: Math.floor(side),
    });
  }

  const ring = 400; // dims the corners outside the circle
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: space.lg,
        }}
      >
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: radius.xl,
            padding: space.lg,
            gap: space.md,
            alignItems: "center",
          }}
        >
          <Txt bold>Ajustar foto</Txt>
          <Txt v="small" muted>
            Arraste a foto para posicionar. Com zoom, ela se move para todos os lados.
          </Txt>
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={begin}
            onResponderMove={move}
            style={
              {
                width: frame,
                height: frame,
                overflow: "hidden",
                borderRadius: radius.md,
                backgroundColor: c.muted,
                // Web: the page must not scroll or zoom under the finger, nor select the photo.
                touchAction: "none",
                userSelect: "none",
                cursor: "grab",
              } as never
            }
          >
            <Image
              source={image.uri}
              style={{
                position: "absolute",
                width,
                height,
                left: (frame - width) / 2 + view.x,
                top: (frame - height) / 2 + view.y,
              }}
              contentFit="fill"
              pointerEvents="none"
              accessibilityLabel="Foto escolhida"
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -ring,
                top: -ring,
                width: frame + ring * 2,
                height: frame + ring * 2,
                borderRadius: frame / 2 + ring,
                borderWidth: ring,
                borderColor: "rgba(0,0,0,0.45)",
              }}
            />
          </View>
          <Row gap={space.sm}>
            <Button kind="ghost" icon={Minus} accessibilityLabel="Diminuir zoom" disabled={view.zoom <= 1} onPress={() => apply({ ...view, zoom: view.zoom / STEP })} />
            <Button kind="ghost" icon={Plus} accessibilityLabel="Aumentar zoom" disabled={view.zoom >= MAX_ZOOM} onPress={() => apply({ ...view, zoom: view.zoom * STEP })} />
          </Row>
          <Row gap={space.sm}>
            <Button kind="ghost" title="Cancelar" onPress={onCancel} />
            <Button kind="primary" title="Usar foto" onPress={done} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
