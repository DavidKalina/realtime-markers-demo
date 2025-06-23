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
    <div className="absolute -top-[120px] left-1/2 transform -translate-x-1/2 flex items-center justify-center z-50">
      <div
        className="bg-[#f9fafb] px-3 py-2 rounded-2xl flex flex-col items-center justify-center border border-gray-200 shadow-xl min-w-[220px] max-w-[280px] transition-all duration-200"
        style={{
          boxShadow:
            "0 6px 32px 0 rgba(0,0,0,0.10), 0 1.5px 6px 0 rgba(0,0,0,0.08)",
        }}
      >
        {/* Type and Status */}
        <div className="flex items-center gap-2 mb-1 w-full justify-center">
          <span className="text-lg leading-none">{typeConfig.emoji}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-700">
            {type.replace("_", " ")}
          </span>
          {status && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-semibold border border-gray-200">
              {status}
            </span>
          )}
        </div>
        {/* Title */}
        <div className="text-gray-900 text-sm font-bold text-center mb-1 break-words w-full">
          {title}
        </div>
        {/* Divider */}
        <div className="w-8 h-[2px] bg-gray-200 rounded-full my-1" />
        {/* Description */}
        {description && (
          <div
            className="relative text-gray-600 text-xs text-center px-1 max-h-[36px] overflow-hidden w-full"
            style={{ lineHeight: "1.3" }}
          >
            <span className="block whitespace-pre-line">
              {description.length > 100
                ? `${description.substring(0, 100)}...`
                : description}
            </span>
            {description.length > 60 && (
              <span className="absolute bottom-0 left-0 w-full h-5 bg-gradient-to-t from-[#f9fafb] to-transparent pointer-events-none" />
            )}
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
