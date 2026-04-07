/**
 * DeckIcon — a custom playing-card-style icon for the "Your Deck" tab.
 * Two overlapping mini cards with rounded corners.
 */

import React from "react";
import Svg, { Rect, Line } from "react-native-svg";

interface DeckIconProps {
  size?: number;
  color: string;
}

const DeckIcon: React.FC<DeckIconProps> = ({ size = 22, color }) => {
  const sw = 1.5;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Back card (offset) */}
      <Rect
        x={6}
        y={2}
        width={14}
        height={18}
        rx={2.5}
        stroke={color}
        strokeWidth={sw}
        fill="none"
      />
      {/* Front card */}
      <Rect
        x={4}
        y={4}
        width={14}
        height={18}
        rx={2.5}
        stroke={color}
        strokeWidth={sw}
        fill="none"
      />
      {/* Decorative lines on front card */}
      <Line x1={8} y1={10} x2={14} y2={10} stroke={color} strokeWidth={1} opacity={0.5} strokeLinecap="round" />
      <Line x1={8} y1={13} x2={12} y2={13} stroke={color} strokeWidth={1} opacity={0.35} strokeLinecap="round" />
    </Svg>
  );
};

export default React.memo(DeckIcon);
