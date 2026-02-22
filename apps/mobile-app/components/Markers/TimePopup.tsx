import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
  FlipInYLeft,
  FlipInYRight,
  FlipInEasyX,
  FlipInEasyY,
  RotateInDownLeft,
  RotateInDownRight,
  BounceIn,
} from "react-native-reanimated";
import { colors, spacing, radius, fontFamily, fontWeight } from "@/theme";

interface TimePopupProps {
  time: string;
  title: string;
  endDate?: string;
  index?: number;
}

// Timing constants
const TIME_DISPLAY_MS = 3000;
const MARQUEE_SPEED = 25; // px per second
const MARQUEE_START_PAUSE = 600;
const MARQUEE_END_PAUSE = 600;
const STATIC_TITLE_MS = 3000;
const MARQUEE_MAX_WIDTH = 130;
const CYCLE_GUARD_MS = 500;

// Marker entrance: index * 300ms delay + ~500ms BounceIn
const MARKER_STAGGER_MS = 300;
const MARKER_ENTRANCE_MS = 500;
// Extra breathing room + random spread after marker settles
const POPUP_SETTLE_MS = 200;
const POPUP_JITTER_RANGE = 300;

// Curated entrance pool — organic, not zany
const ENTRANCE_POOL = [
  (d: number) => ZoomIn.duration(400).delay(d),
  (d: number) => FlipInYLeft.duration(450).delay(d),
  (d: number) => FlipInYRight.duration(450).delay(d),
  (d: number) => FlipInEasyX.duration(400).delay(d),
  (d: number) => FlipInEasyY.duration(400).delay(d),
  (d: number) => RotateInDownLeft.duration(450).delay(d),
  (d: number) => RotateInDownRight.duration(450).delay(d),
  (d: number) => BounceIn.duration(500).delay(d),
];

const TimeContent: React.FC<{
  timeLeft: string;
  isExpired: boolean;
  hourglassStyle: {
    transform: {
      rotate: string;
    }[];
  };
  onComplete: () => void;
}> = React.memo(({ timeLeft, isExpired, hourglassStyle, onComplete }) => {
  const called = useRef(false);

  useEffect(() => {
    called.current = false;
    const timer = setTimeout(() => {
      if (!called.current) {
        called.current = true;
        onComplete();
      }
    }, TIME_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={styles.timeRow}>
      {isExpired ? (
        <Text style={styles.emojiText}>⏰</Text>
      ) : (
        <Animated.Text style={[styles.emojiText, hourglassStyle]}>
          ⌛️
        </Animated.Text>
      )}
      <Text style={styles.countdownText}>{timeLeft}</Text>
    </View>
  );
});

const TitleContent: React.FC<{
  title: string;
  titleWidth: number;
  onComplete: () => void;
}> = React.memo(({ title, titleWidth, onComplete }) => {
  const translateX = useSharedValue(0);
  const called = useRef(false);

  const overflow =
    titleWidth > 0 ? titleWidth - MARQUEE_MAX_WIDTH + spacing.xs * 2 : 0;
  const needsMarquee = overflow > 0;

  useEffect(() => {
    if (titleWidth <= 0) return;
    called.current = false;
    translateX.value = 0;

    if (needsMarquee) {
      const scrollMs = (overflow / MARQUEE_SPEED) * 1000;

      const scrollTimer = setTimeout(() => {
        translateX.value = withTiming(-overflow, {
          duration: scrollMs,
          easing: Easing.linear,
        });
      }, MARQUEE_START_PAUSE);

      const doneTimer = setTimeout(
        () => {
          if (!called.current) {
            called.current = true;
            onComplete();
          }
        },
        MARQUEE_START_PAUSE + scrollMs + MARQUEE_END_PAUSE,
      );

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(doneTimer);
        cancelAnimation(translateX);
      };
    } else {
      const timer = setTimeout(() => {
        if (!called.current) {
          called.current = true;
          onComplete();
        }
      }, STATIC_TITLE_MS);

      return () => clearTimeout(timer);
    }
  }, [titleWidth, needsMarquee, overflow, onComplete]);

  const marqueeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.marqueeClip}>
      <Animated.View style={marqueeStyle}>
        <Text style={[styles.titleText, needsMarquee && { width: titleWidth }]}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
});

export const TimePopup: React.FC<TimePopupProps> = React.memo(
  ({ time, title, endDate, index = 0 }) => {
    const [visible, setVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [showTitle, setShowTitle] = useState(false);
    const [titleWidth, setTitleWidth] = useState(0);

    const guardRef = useRef(false);
    const isInitial = useRef(true);
    const rotateAnimation = useSharedValue(0);

    // Each popup picks a random entrance style once on mount
    const animIndex = useRef(
      Math.floor(Math.random() * ENTRANCE_POOL.length),
    ).current;

    // Wait for this marker's staggered entrance to finish, then show popup
    useEffect(() => {
      const markerDone = index * MARKER_STAGGER_MS + MARKER_ENTRANCE_MS;
      const jitter = Math.floor(Math.random() * POPUP_JITTER_RANGE);
      const timer = setTimeout(
        () => setVisible(true),
        markerDone + POPUP_SETTLE_MS + jitter,
      );
      return () => clearTimeout(timer);
    }, [index]);

    // Callback-driven cycling
    const cycleToTitle = useCallback(() => {
      if (guardRef.current) return;
      guardRef.current = true;
      isInitial.current = false;
      setShowTitle(true);
      setTimeout(() => {
        guardRef.current = false;
      }, CYCLE_GUARD_MS);
    }, []);

    const cycleToTime = useCallback(() => {
      if (guardRef.current) return;
      guardRef.current = true;
      setShowTitle(false);
      setTimeout(() => {
        guardRef.current = false;
      }, CYCLE_GUARD_MS);
    }, []);

    // Hourglass rotation animation
    useEffect(() => {
      if (!isExpired) {
        rotateAnimation.value = withRepeat(
          withSequence(
            withTiming(360, {
              duration: 800,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(340, {
              duration: 150,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(370, {
              duration: 150,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(360, {
              duration: 100,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(360, {
              duration: 3000,
            }),
            withTiming(0, { duration: 0 }),
          ),
          -1,
          false,
        );
      } else {
        cancelAnimation(rotateAnimation);
        rotateAnimation.value = withTiming(0);
      }

      return () => {
        cancelAnimation(rotateAnimation);
      };
    }, [isExpired]);

    const hourglassStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${rotateAnimation.value}deg` }],
      };
    });

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
            let hours = parseInt(timePart);
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
              let hours = parseInt(timePart);
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

    // First appearance: random entrance. Cycles: quiet crossfade.
    const entering = isInitial.current
      ? ENTRANCE_POOL[animIndex](0)
      : FadeIn.duration(200);
    const exiting = FadeOut.duration(150);

    return (
      <View style={styles.container}>
        {/* Off-screen measurement text (always rendered for measuring) */}
        <Text
          style={styles.measureText}
          onLayout={(e) => setTitleWidth(Math.ceil(e.nativeEvent.layout.width))}
        >
          {title}
        </Text>

        {visible && !showTitle && (
          <Animated.View
            entering={entering}
            exiting={exiting}
            style={[styles.badgeContainer, styles.absolute]}
          >
            <TimeContent
              timeLeft={timeLeft}
              isExpired={isExpired}
              hourglassStyle={hourglassStyle}
              onComplete={cycleToTitle}
            />
          </Animated.View>
        )}

        {visible && showTitle && (
          <Animated.View
            entering={entering}
            exiting={exiting}
            style={[styles.badgeContainer, styles.absolute]}
          >
            <TitleContent
              title={title}
              titleWidth={titleWidth}
              onComplete={cycleToTime}
            />
          </Animated.View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -50,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  absolute: {
    position: "absolute",
  },
  badgeContainer: {
    backgroundColor: colors.text.primary,
    paddingHorizontal: spacing._10,
    paddingVertical: spacing._6,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.accent,
    shadowColor: colors.shadow.default,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    maxWidth: 150,
    minHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  marqueeClip: {
    overflow: "hidden",
    maxWidth: MARQUEE_MAX_WIDTH,
    minHeight: 20,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  measureText: {
    position: "absolute",
    opacity: 0,
    top: -9999,
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  emojiText: {
    fontSize: 11,
    lineHeight: 13,
    paddingHorizontal: 1,
  },
  countdownText: {
    color: colors.bg.card,
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  titleText: {
    color: colors.bg.card,
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
});
