// components/Districts/EmojiMapImageGenerator.tsx
//
// Renders emoji marker images as hidden off-screen SVGs — each image is a
// dark circle with a colored border and the emoji centred inside.  Captured
// via react-native-svg's toDataURL() and handed back as base64 PNGs for
// MapboxGL.Images / SymbolLayer iconImage.
//
// Uses a ref-based queue so incoming WebSocket specs never clobber an
// in-progress capture batch.
//
// Must be mounted OUTSIDE MapboxGL.MapView (regular RN views can't be
// MapView children).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

/** Size (in points) of each captured marker image. */
const ICON_SIZE = 64;
const HALF = ICON_SIZE / 2;
const CIRCLE_R = HALF - 3;
const STROKE_W = 3;

export interface MarkerImageSpec {
  emoji: string;
  borderColor: string;
}

interface EmojiMapImageGeneratorProps {
  specs: MarkerImageSpec[];
  onImagesReady: (images: Record<string, { uri: string }>) => void;
}

/**
 * Deterministic image key for a given (emoji, borderColor) pair.
 * Used as both the Mapbox image name and the GeoJSON feature property.
 */
export function markerImageKey(emoji: string, borderColor: string): string {
  const emojiHex = [...emoji]
    .map((c) => (c.codePointAt(0) ?? 0).toString(16))
    .join("-");
  const colorHex = borderColor.replace("#", "");
  return `marker-${emojiHex}-${colorHex}`;
}

const EmojiMapImageGeneratorInner: React.FC<EmojiMapImageGeneratorProps> = ({
  specs,
  onImagesReady,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svgRefs = useRef<Map<string, any>>(new Map());
  const capturedKeys = useRef<Set<string>>(new Set());
  const imagesRef = useRef<Record<string, { uri: string }>>({});
  const onReadyRef = useRef(onImagesReady);
  onReadyRef.current = onImagesReady;

  // Ref-based queue — never clobbered by state updates
  const queue = useRef<MarkerImageSpec[]>([]);
  const isBusy = useRef(false);
  const lastEmittedCount = useRef(0);

  // The batch currently mounted as hidden SVGs
  const [batch, setBatch] = useState<MarkerImageSpec[]>([]);

  // Emit images to parent only when count actually changed
  const emitIfNew = useCallback(() => {
    const count = Object.keys(imagesRef.current).length;
    if (count > 0 && count !== lastEmittedCount.current) {
      lastEmittedCount.current = count;
      onReadyRef.current({ ...imagesRef.current });
    }
  }, []);

  // Pull everything off the queue into the next batch
  const processQueue = useCallback(() => {
    if (queue.current.length === 0) {
      isBusy.current = false;
      setBatch([]);
      return;
    }
    isBusy.current = true;
    const next = queue.current.splice(0);
    setBatch(next);
  }, []);

  // When specs change, enqueue anything not yet captured or in-flight
  useEffect(() => {
    const inFlight = new Set(
      batch.map((s) => markerImageKey(s.emoji, s.borderColor)),
    );
    const queued = new Set(
      queue.current.map((s) => markerImageKey(s.emoji, s.borderColor)),
    );

    const fresh: MarkerImageSpec[] = [];
    for (const s of specs) {
      const key = markerImageKey(s.emoji, s.borderColor);
      if (!capturedKeys.current.has(key) && !inFlight.has(key) && !queued.has(key)) {
        fresh.push(s);
      }
    }

    if (fresh.length > 0) {
      queue.current.push(...fresh);
      if (!isBusy.current) processQueue();
    } else {
      emitIfNew();
    }
  }, [specs, batch, processQueue, emitIfNew]);

  // After batch SVGs mount, wait for layout then capture
  useEffect(() => {
    if (batch.length === 0) return;

    const timer = setTimeout(() => {
      let remaining = batch.length;

      const finish = () => {
        remaining--;
        if (remaining <= 0) {
          emitIfNew();
          processQueue(); // drain any specs that arrived mid-capture
        }
      };

      for (const spec of batch) {
        const key = markerImageKey(spec.emoji, spec.borderColor);
        const ref = svgRefs.current.get(key);
        if (!ref || typeof ref.toDataURL !== "function") {
          capturedKeys.current.add(key); // mark so we don't retry forever
          finish();
          continue;
        }

        ref.toDataURL((base64: string) => {
          imagesRef.current[key] = {
            uri: `data:image/png;base64,${base64}`,
          };
          capturedKeys.current.add(key);
          finish();
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [batch, emitIfNew, processQueue]);

  if (batch.length === 0) return null;

  return (
    <View style={hiddenStyles.container} pointerEvents="none">
      {batch.map((spec) => {
        const key = markerImageKey(spec.emoji, spec.borderColor);
        return (
          <Svg
            key={key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={(ref: any) => {
              if (ref) svgRefs.current.set(key, ref);
            }}
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
          >
            <Circle
              cx={HALF}
              cy={HALF}
              r={CIRCLE_R}
              fill="rgba(26, 26, 26, 0.9)"
              stroke={spec.borderColor}
              strokeWidth={STROKE_W}
            />
            <SvgText
              x={HALF}
              y={HALF + 10}
              fontSize={28}
              textAnchor="middle"
            >
              {spec.emoji}
            </SvgText>
          </Svg>
        );
      })}
    </View>
  );
};

const hiddenStyles = StyleSheet.create({
  container: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },
});

export const EmojiMapImageGenerator = React.memo(
  EmojiMapImageGeneratorInner,
);
