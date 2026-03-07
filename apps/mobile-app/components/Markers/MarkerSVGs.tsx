import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { useColors } from "@/theme";

// Constants
export const MARKER_WIDTH = 48;
export const MARKER_HEIGHT = 64;
export const SHADOW_OFFSET = { x: 3, y: 3 };

interface MarkerSVGProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  highlightStrokeWidth?: string | number;
  circleRadius?: string | number;
  circleStroke?: string;
  circleStrokeWidth?: string | number;
}

// Shared Shadow SVG component
export const ShadowSVG: React.FC = React.memo(() => {
  const colors = useColors();
  return (
    <Svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
      <Path
        d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
        fill={colors.shadow.default}
        fillOpacity="0.3"
      />
    </Svg>
  );
});

// Shared Marker SVG component
export const MarkerSVG: React.FC<MarkerSVGProps> = React.memo(
  ({
    fill,
    stroke,
    strokeWidth = "3",
    highlightStrokeWidth = "2.5",
    circleRadius = "12",
    circleStroke,
    circleStrokeWidth = "1",
  }) => {
    const colors = useColors();
    const resolvedFill = fill ?? colors.bg.primary;
    const resolvedStroke = stroke ?? colors.text.primary;
    const resolvedCircleStroke = circleStroke ?? colors.border.medium;
    return (
      <Svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
        {/* Teardrop marker */}
        <Path
          d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
          fill={resolvedFill}
          stroke={resolvedStroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />

        {/* Nintendo-style highlight */}
        <Path
          d="M16 12C16 12 19 9 24 9C29 9 32 12 32 12"
          stroke={colors.text.primary}
          strokeOpacity="0.7"
          strokeWidth={highlightStrokeWidth}
          strokeLinecap="round"
        />

        {/* Background circle */}
        <Circle
          cx="24"
          cy="22"
          r={circleRadius}
          fill={colors.bg.card}
          stroke={resolvedCircleStroke}
          strokeWidth={circleStrokeWidth}
        />
      </Svg>
    );
  },
);
