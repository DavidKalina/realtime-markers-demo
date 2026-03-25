// components/Districts/EmojiMapImageGenerator.tsx
//
// Renders emoji marker images as hidden off-screen SVGs — each image is a
// dark circle with a colored border and the emoji centred inside.  Captured
// via react-native-svg's toDataURL() and handed back as base64 PNGs for
// MapboxGL.Images / SymbolLayer iconImage.
//
// Must be mounted OUTSIDE MapboxGL.MapView (regular RN views can't be
// MapView children).

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

/** Size (in points) of each captured marker image. */
const ICON_SIZE = 64;
const HALF = ICON_SIZE / 2;
const CIRCLE_R = HALF - 3; // leave room for stroke
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
  const capturedSet = useRef<Set<string>>(new Set());
  const imagesRef = useRef<Record<string, { uri: string }>>({});
  const [toRender, setToRender] = useState<MarkerImageSpec[]>([]);
  const onImagesReadyRef = useRef(onImagesReady);
  onImagesReadyRef.current = onImagesReady;

  // Determine which specs still need capturing
  useEffect(() => {
    const needed = specs.filter(
      (s) => !capturedSet.current.has(markerImageKey(s.emoji, s.borderColor)),
    );
    if (needed.length > 0) {
      setToRender(needed);
    } else if (Object.keys(imagesRef.current).length > 0) {
      onImagesReadyRef.current({ ...imagesRef.current });
    }
  }, [specs]);

  // After hidden SVGs mount, capture each to a base64 PNG
  useEffect(() => {
    if (toRender.length === 0) return;

    const timer = setTimeout(() => {
      let remaining = toRender.length;

      const finish = () => {
        remaining--;
        if (remaining <= 0) {
          onImagesReadyRef.current({ ...imagesRef.current });
          setToRender([]);
        }
      };

      for (const spec of toRender) {
        const key = markerImageKey(spec.emoji, spec.borderColor);
        const ref = svgRefs.current.get(key);
        if (!ref || typeof ref.toDataURL !== "function") {
          finish();
          continue;
        }

        ref.toDataURL((base64: string) => {
          imagesRef.current[key] = {
            uri: `data:image/png;base64,${base64}`,
          };
          capturedSet.current.add(key);
          finish();
        });
      }
    }, 150); // Small delay for SVG layout

    return () => clearTimeout(timer);
  }, [toRender]);

  if (toRender.length === 0) return null;

  return (
    <View style={hiddenStyles.container} pointerEvents="none">
      {toRender.map((spec) => {
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
            {/* Dark circle with district-colored border */}
            <Circle
              cx={HALF}
              cy={HALF}
              r={CIRCLE_R}
              fill="rgba(26, 26, 26, 0.9)"
              stroke={spec.borderColor}
              strokeWidth={STROKE_W}
            />
            {/* Emoji centred inside */}
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
