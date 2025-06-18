import React, { useMemo, useState, useEffect } from "react";
import {
  MarkerSVG,
  ShadowSVG,
  TimePopup,
  MARKER_WIDTH,
  MARKER_HEIGHT,
  SHADOW_OFFSET,
} from "./MapMojiMarkerSVG";

// Define the Marker interface
export interface Marker {
  id: string;
  data: {
    emoji: string;
    title?: string;
    eventDate?: string;
    endDate?: string;
    isPrivate?: boolean;
  };
  coordinates: [number, number];
}

interface MapMojiMarkerProps {
  event: Marker;
  onPress: () => void;
  isHighlighted?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Color constants
const COLORS = {
  accent: "#3B82F6",
  accentDark: "#1D4ED8",
};

export const MapMojiMarker: React.FC<MapMojiMarkerProps> = React.memo(
  ({ event, onPress, style, className = "" }) => {
    const [showRipple, setShowRipple] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    // Memoize SVG components
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={event.data.isPrivate ? COLORS.accent : "#1a1a1a"}
          stroke={event.data.isPrivate ? COLORS.accentDark : "white"}
          strokeWidth="3"
          circleRadius="12"
          circleStroke={event.data.isPrivate ? COLORS.accentDark : "#E2E8F0"}
          circleStrokeWidth="1"
        />
      ),
      [event.data.isPrivate],
    );

    // Trigger popup entrance after marker appears
    useEffect(() => {
      const popupDelay = 100 + Math.random() * 200; // Reduced delay between 100-300ms
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, popupDelay);

      return () => clearTimeout(timer);
    }, []);

    // Trigger ripple effect after drop-in animation completes with random delay
    useEffect(() => {
      // Add random delay (200-400ms) to prevent all ripples from appearing at the same time
      const rippleDelay = 200 + Math.random() * 200; // Reduced from 300-600ms

      const timer = setTimeout(() => {
        setShowRipple(true);
      }, rippleDelay);

      return () => clearTimeout(timer);
    }, []);

    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{
          width: MARKER_WIDTH,
          height: MARKER_HEIGHT,
          filter:
            "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 20px rgba(59, 130, 246, 0.2))",
          ...style,
        }}
      >
        {/* Ripple Effect */}
        {showRipple && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-0">
            <div className="w-16 h-16 bg-blue-400/80 rounded-full animate-ripple"></div>
          </div>
        )}

        {/* Popup */}
        {showPopup && (
          <div className="absolute w-full z-10 popup-entrance">
            <TimePopup
              time={event.data.eventDate || ""}
              endDate={event.data.endDate || ""}
              title={event.data.title || ""}
            />
          </div>
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
          className="flex items-center justify-center transition-all duration-300 hover:opacity-90 active:opacity-70 hover:scale-110 active:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 relative z-10"
          style={{
            width: MARKER_WIDTH,
            height: MARKER_HEIGHT,
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))",
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
                {event.data.emoji}
              </span>
            </div>
          </div>
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders
    return (
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.data.emoji === nextProps.event.data.emoji &&
      prevProps.event.data.title === nextProps.event.data.title
    );
  },
);

MapMojiMarker.displayName = "MapMojiMarker";
