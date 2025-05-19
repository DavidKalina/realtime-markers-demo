import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

interface TimePopupProps {
  time: string;
  title: string;
  endDate?: string;
}

const TimeContent: React.FC<{
  timeLeft: string;
  isExpired: boolean;
  animatedStyle: {
    transform: {
      rotate: string;
    }[];
  };
}> = React.memo(({ timeLeft, isExpired, animatedStyle }) => {
  return (
    <View style={styles.contentContainer}>
      {isExpired ? (
        <Text style={styles.emojiText}>⏰</Text>
      ) : (
        <Animated.Text style={[styles.emojiText, animatedStyle]}>
          ⌛️
        </Animated.Text>
      )}
      <Text style={styles.countdownText}>{timeLeft}</Text>
    </View>
  );
});

const TitleContent: React.FC<{ title: string }> = React.memo(({ title }) => {
  return (
    <View style={styles.contentContainer}>
      <Text style={styles.titleText} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
});

export const TimePopup: React.FC<TimePopupProps> = React.memo(
  ({ time, title, endDate }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [showTitle, setShowTitle] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const rotateAnimation = useSharedValue(0);
    const intervalRef = useRef<NodeJS.Timeout>();

    // Toggle between time and title every 4 seconds
    useEffect(() => {
      const cycleContent = () => {
        if (isAnimating) return;

        setIsAnimating(true);
        setShowTitle((prev) => !prev);

        // Reset animation state after the transition is complete
        setTimeout(() => {
          setIsAnimating(false);
        }, 700);
      };

      intervalRef.current = setInterval(cycleContent, 4000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [isAnimating]);

    // Set up rotation animation
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

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${rotateAnimation.value}deg` }],
      };
    });

    const timeContentStyle = useAnimatedStyle(() => {
      return {
        position: "absolute",
      };
    });

    const titleContentStyle = useAnimatedStyle(() => {
      return {
        position: "absolute",
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

    return (
      <View style={styles.container}>
        {!showTitle && (
          <Animated.View
            entering={ZoomIn.duration(400).delay(300)}
            exiting={ZoomOut.duration(300)}
            style={[styles.badgeContainer, timeContentStyle]}
          >
            <TimeContent
              timeLeft={timeLeft}
              isExpired={isExpired}
              animatedStyle={animatedStyle}
            />
          </Animated.View>
        )}

        {showTitle && (
          <Animated.View
            entering={ZoomIn.duration(400).delay(300)}
            exiting={ZoomOut.duration(300)}
            style={[styles.badgeContainer, titleContentStyle]}
          >
            <TitleContent title={title} />
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
  badgeContainer: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    maxWidth: 150,
    minHeight: 20,
    paddingHorizontal: 4,
  },
  emojiText: {
    fontSize: 11,
    lineHeight: 13,
    paddingHorizontal: 1,
  },
  countdownText: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 11,
    lineHeight: 13,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  titleText: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 11,
    lineHeight: 13,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingHorizontal: 2,
  },
});
