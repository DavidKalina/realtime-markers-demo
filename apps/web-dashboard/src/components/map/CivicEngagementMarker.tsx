import React, { useMemo, useState } from "react";
import {
  MarkerSVG,
  ShadowSVG,
  MARKER_WIDTH,
  MARKER_HEIGHT,
  SHADOW_OFFSET,
} from "./MapMojiMarkerSVG";
import type { Marker } from "@/hooks/useMapWebsocketWeb";

interface CivicEngagementMarkerProps {
  marker: Marker;
  onPress: () => void;
  isHighlighted?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const TYPE_CONFIG = {
  IDEA: { color: "#fbbf24", emoji: "💡" },
  NEGATIVE_FEEDBACK: { color: "#ef4444", emoji: "⚠️" },
  POSITIVE_FEEDBACK: { color: "#22c55e", emoji: "👍" },
  QUESTION: { color: "#3b82f6", emoji: "❓" },
  COMPLAINT: { color: "#ef4444", emoji: "⚠️" },
  COMPLIMENT: { color: "#22c55e", emoji: "👍" },
  DEFAULT: { color: "#6b7280", emoji: "📝" },
};

// Civic Engagement Popup Component
const CivicEngagementPopup: React.FC<{
  title: string;
  description?: string;
  type: string;
  status?: string;
}> = React.memo(({ title, description, type, status }) => {
  const typeConfig =
    TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.DEFAULT;

  return (
    <div className="absolute -top-[80px] left-1/2 transform -translate-x-1/2 flex items-center justify-center z-50">
      <div className="bg-white px-3 py-2 rounded-lg flex flex-col items-center justify-center border border-white/15 shadow-lg min-w-[200px] max-w-[250px] hover:shadow-xl hover:scale-105 hover:border-white/25 transition-all duration-200">
        {/* Type and Status */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{typeConfig.emoji}</span>
          <span className="text-[#2a2a2a] text-[11px] leading-[13px] font-space-mono font-medium tracking-wider">
            {type.replace("_", " ")}
          </span>
          {status && (
            <span className="text-[#6b7280] text-[10px] leading-[12px] font-space-mono">
              • {status}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="text-[#2a2a2a] text-[12px] leading-[14px] font-space-mono font-medium tracking-wider text-center px-1 mb-1">
          {title}
        </div>

        {/* Description */}
        {description && (
          <div className="text-[#6b7280] text-[10px] leading-[12px] font-space-mono text-center px-1 max-h-[40px] overflow-hidden">
            {description.length > 60
              ? `${description.substring(0, 60)}...`
              : description}
          </div>
        )}
      </div>
    </div>
  );
});

CivicEngagementPopup.displayName = "CivicEngagementPopup";

export const CivicEngagementMarker: React.FC<CivicEngagementMarkerProps> =
  React.memo(({ marker, onPress, isHighlighted, style, className = "" }) => {
    const [isHovered, setIsHovered] = useState(false);

    const type = marker.data.type || "DEFAULT";
    const { color, emoji } =
      TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.DEFAULT;

    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={color}
          stroke={isHighlighted ? "#fbbf24" : "white"}
          strokeWidth={isHighlighted ? "4" : "3"}
          circleRadius="12"
          circleStroke={isHighlighted ? "#fbbf24" : "#E2E8F0"}
          circleStrokeWidth="1"
        />
      ),
      [color, isHighlighted],
    );

    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{
          width: MARKER_WIDTH,
          height: MARKER_HEIGHT,
          filter:
            "drop-shadow(0 4px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 20px rgba(59,130,246,0.2))",
          ...style,
        }}
      >
        {/* Hover Popup */}
        {isHovered && (
          <CivicEngagementPopup
            title={marker.data.title}
            description={marker.data.description}
            type={type}
            status={marker.data.status}
          />
        )}

        {/* Marker Shadow */}
        <div
          className="absolute bottom-0 -z-10 opacity-30"
          style={{
            transform: `translate(${SHADOW_OFFSET.x}px, ${SHADOW_OFFSET.y}px)`,
          }}
        >
          {ShadowSvg}
        </div>
        {/* Marker */}
        <button
          onClick={onPress}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex items-center justify-center transition-all duration-300 hover:opacity-90 active:opacity-70 hover:scale-110 active:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 relative z-10"
          style={{
            width: MARKER_WIDTH,
            height: MARKER_HEIGHT,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          }}
        >
          <div
            className="flex items-center justify-center relative"
            style={{ width: MARKER_WIDTH, height: MARKER_HEIGHT }}
          >
            {MarkerSvg}
            {/* Emoji */}
            <div
              className="absolute top-[10px] flex items-center justify-center"
              style={{ width: MARKER_WIDTH, height: 20 }}
            >
              <span className="text-sm leading-[18px] text-center p-0.5 drop-shadow-sm">
                {emoji}
              </span>
            </div>
          </div>
        </button>
      </div>
    );
  });

CivicEngagementMarker.displayName = "CivicEngagementMarker";
