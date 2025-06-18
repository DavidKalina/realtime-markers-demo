import React, { useEffect, useRef, useState } from "react";

// Constants
export const MARKER_WIDTH = 48;
export const MARKER_HEIGHT = 64;
export const SHADOW_OFFSET = { x: 3, y: 3 };

// Colors (you may want to move these to a separate constants file)
const COLORS = {
  background: "#1a1a1a",
  textPrimary: "#ffffff",
  buttonBorder: "#333333",
  cardBackground: "#2a2a2a",
  shadow: "#000000",
};

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
export const ShadowSVG: React.FC = React.memo(() => (
  <svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
    <path
      d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
      fill={COLORS.shadow}
      fillOpacity="0.3"
    />
  </svg>
));

ShadowSVG.displayName = "ShadowSVG";

// Shared Marker SVG component
export const MarkerSVG: React.FC<MarkerSVGProps> = React.memo(
  ({
    fill = COLORS.background,
    stroke = COLORS.textPrimary,
    strokeWidth = "3",
    highlightStrokeWidth = "2.5",
    circleRadius = "12",
    circleStroke = COLORS.buttonBorder,
    circleStrokeWidth = "1",
  }) => (
    <svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
      {/* Teardrop marker */}
      <path
        d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />

      {/* Nintendo-style highlight */}
      <path
        d="M16 12C16 12 19 9 24 9C29 9 32 12 32 12"
        stroke={COLORS.textPrimary}
        strokeOpacity="0.7"
        strokeWidth={highlightStrokeWidth}
        strokeLinecap="round"
      />

      {/* Background circle */}
      <circle
        cx="24"
        cy="22"
        r={circleRadius}
        fill={COLORS.cardBackground}
        stroke={circleStroke}
        strokeWidth={circleStrokeWidth}
      />
    </svg>
  ),
);

MarkerSVG.displayName = "MarkerSVG";

// Time popup component
interface TimePopupProps {
  time: string;
  title: string;
  endDate?: string;
}

const TimeContent: React.FC<{
  timeLeft: string;
  isExpired: boolean;
}> = React.memo(({ timeLeft, isExpired }) => {
  return (
    <div className="flex flex-row items-center justify-center gap-2 max-w-[200px] min-h-[20px] px-2">
      {isExpired ? (
        <span className="text-[11px] leading-[13px] px-0.5">⏰</span>
      ) : (
        <span className="text-[11px] leading-[13px] px-0.5 animate-spin-slow">
          ⌛️
        </span>
      )}
      <span className="text-[#2a2a2a] text-[11px] leading-[13px] font-space-mono font-medium tracking-wider">
        {timeLeft}
      </span>
    </div>
  );
});

TimeContent.displayName = "TimeContent";

const TitleContent: React.FC<{ title: string }> = React.memo(({ title }) => {
  return (
    <div className="flex flex-row items-center justify-center gap-2 max-w-[200px] min-h-[20px] px-2">
      <span className="text-[#2a2a2a] text-[11px] leading-[13px] font-space-mono font-medium tracking-wider text-center px-0.5 truncate">
        {title}
      </span>
    </div>
  );
});

TitleContent.displayName = "TitleContent";

export const TimePopup: React.FC<TimePopupProps> = React.memo(
  ({ time, title, endDate }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [showTitle, setShowTitle] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Toggle between time and title with random delays to prevent synchronization
    useEffect(() => {
      const cycleContent = () => {
        if (isAnimating) return;

        setIsAnimating(true);

        // Reduced delay for snappier transitions
        setTimeout(() => {
          setShowTitle((prev) => !prev);
        }, 150); // Reduced from 250ms for faster transitions

        // Reset animation state after the transition is complete
        setTimeout(() => {
          setIsAnimating(false);
        }, 300); // Reduced from 500ms for snappier feel
      };

      // Add random initial delay (0-2 seconds) to prevent all popups from starting at the same time
      const initialDelay = Math.random() * 2000; // Reduced from 3000ms

      // Slightly vary the cycle timing (3-4 seconds) for each popup instance
      const cycleInterval = 3000 + Math.random() * 1000; // Reduced from 3500ms base

      const startInterval = () => {
        intervalRef.current = setInterval(cycleContent, cycleInterval);
      };

      // Start with initial delay, then begin regular cycling
      const initialTimer = setTimeout(startInterval, initialDelay);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        clearTimeout(initialTimer);
      };
    }, [isAnimating]);

    // Time calculation effect
    useEffect(() => {
      const calculateTimeLeft = () => {
        try {
          let eventDate: Date;
          let eventEndDate: Date | undefined;

          if (time.includes("@")) {
            const [datePart, timePart] = time.split("@").map((s) => s.trim());
            const cleanDateStr = datePart.replace(/(st|nd|rd|th),?/g, "");
            const dateObj = new Date(cleanDateStr);

            if (isNaN(dateObj.getTime())) {
              console.error("Failed to parse date:", cleanDateStr);
              throw new Error("Invalid date format");
            }

            const isPM = timePart.toLowerCase().includes("pm");
            let hours = parseInt(timePart, 10);
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;

            dateObj.setHours(hours, 0, 0, 0);
            eventDate = dateObj;
          } else if (time.includes("/")) {
            const [month, day, year] = time
              .split("/")
              .map((num) => parseInt(num, 10));
            eventDate = new Date(year, month - 1, day, 0, 0, 0);
          } else {
            eventDate = new Date(time);
          }

          if (endDate) {
            if (endDate.includes("@")) {
              const [datePart, timePart] = endDate
                .split("@")
                .map((s) => s.trim());
              const dateObj = new Date(datePart);

              const isPM = timePart.toLowerCase().includes("pm");
              let hours = parseInt(timePart, 10);
              if (isPM && hours !== 12) hours += 12;
              if (!isPM && hours === 12) hours = 0;

              dateObj.setHours(hours, 0, 0, 0);
              eventEndDate = dateObj;
            } else if (endDate.includes("/")) {
              const [month, day, year] = endDate
                .split("/")
                .map((num) => parseInt(num, 10));
              eventEndDate = new Date(year, month - 1, day, 23, 59, 59);
            } else {
              eventEndDate = new Date(endDate);
            }
          }

          if (isNaN(eventDate.getTime())) {
            setTimeLeft("NaN");
            setIsExpired(true);
            return;
          }

          const now = new Date();

          if (eventEndDate && now > eventDate && now < eventEndDate) {
            const diff = eventEndDate.getTime() - now.getTime();
            const hours = (diff / (1000 * 60 * 60)).toFixed(1);
            setTimeLeft(`${hours} ${hours === "1.0" ? "hour" : "hours"} left`);
            setIsExpired(false);
            return;
          }

          if (eventEndDate && now > eventEndDate) {
            setTimeLeft("expired");
            setIsExpired(true);
            return;
          }

          const diff = eventDate.getTime() - now.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60);
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

          if (diff < 0) {
            setTimeLeft("expired");
            setIsExpired(true);
          } else if (days > 0) {
            setTimeLeft(`in ${days} ${days === 1 ? "day" : "days"}`);
            setIsExpired(false);
          } else if (hours >= 1) {
            setTimeLeft(
              `in ${hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`,
            );
            setIsExpired(false);
          } else {
            setTimeLeft(`in ${minutes} ${minutes === 1 ? "min" : "mins"}`);
            setIsExpired(false);
          }
        } catch (error) {
          console.error("Error parsing date:", error, "time:", time);
          setTimeLeft("NaN");
          setIsExpired(true);
        }
      };

      calculateTimeLeft();
      const interval = setInterval(calculateTimeLeft, 60000);

      return () => clearInterval(interval);
    }, [time, endDate]);

    return (
      <div className="absolute -top-[70px] left-1/2 transform -translate-x-1/2 flex items-center justify-center">
        {!showTitle && (
          <div
            className={`bg-white px-3 py-2 rounded-lg flex items-center justify-center border border-white/15 shadow-lg min-w-[180px] popup-transition hover:shadow-xl hover:scale-105 hover:border-white/25 ${
              isAnimating
                ? "opacity-0 scale-95 translate-y-1"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <TimeContent timeLeft={timeLeft} isExpired={isExpired} />
          </div>
        )}

        {showTitle && (
          <div
            className={`bg-white px-3 py-2 rounded-lg flex items-center justify-center border border-white/15 shadow-lg min-w-[180px] popup-transition hover:shadow-xl hover:scale-105 hover:border-white/25 ${
              isAnimating
                ? "opacity-0 scale-95 translate-y-1"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <TitleContent title={title} />
          </div>
        )}
      </div>
    );
  },
);

TimePopup.displayName = "TimePopup";
