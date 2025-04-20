import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

interface TimePopupProps {
  time: string;
  title: string;
  endDate?: string;
  categories?: string[];
}

const TimeContent: React.FC<{ timeLeft: string; isExpired: boolean; animatedStyle: any }> =
  React.memo(({ timeLeft, isExpired, animatedStyle }) => {
    return (
      <View style={styles.contentContainer}>
        {isExpired ? (
          <Text style={styles.emojiText}>⏰</Text>
        ) : (
          <Animated.Text style={[styles.emojiText, animatedStyle]}>⌛️</Animated.Text>
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

const CategoryContent: React.FC<{ categories: string[] }> = React.memo(({ categories }) => {
  // Show only first 2 categories
  const displayCategories = categories?.slice(0, 2) || [];

  return (
    <View style={styles.contentContainer}>
      <Text style={styles.categoryText} numberOfLines={1}>
        {displayCategories.join(", ")}
      </Text>
    </View>
  );
});

export const TimePopup: React.FC<TimePopupProps> = React.memo(
  ({ time, title, endDate, categories = [] }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [contentType, setContentType] = useState<"time" | "title" | "category">("time");

    const rotateAnimation = useSharedValue(0);
    const transitionAnimation = useSharedValue(0);
    const intervalRef = useRef<NodeJS.Timeout>();
    const calculateIntervalRef = useRef<NodeJS.Timeout>();

    // Cleanup function for animations
    const cleanupAnimations = useCallback(() => {
      cancelAnimation(rotateAnimation);
      cancelAnimation(transitionAnimation);
    }, []);

    // Toggle between time, title, and categories every 4 seconds
    useEffect(() => {
      const cycleContent = () => {
        setContentType((prev) => {
          if (prev === "time") {
            transitionAnimation.value = withTiming(1, {
              duration: 600,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            });
            return "title";
          }
          if (prev === "title" && categories.length > 0) {
            transitionAnimation.value = withTiming(2, {
              duration: 600,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            });
            return "category";
          }
          transitionAnimation.value = withTiming(0, {
            duration: 600,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          });
          return "time";
        });
      };

      intervalRef.current = setInterval(cycleContent, 4000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [categories.length]);

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
            // Settle back to 360
            withTiming(360, {
              duration: 100,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            // Pause for 3 seconds
            withTiming(360, {
              duration: 3000,
            }),
            // Reset to 0 instantly for next rotation
            withTiming(0, { duration: 0 })
          ),
          -1,
          false
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
        opacity: transitionAnimation.value === 0 ? 1 : 0,
        transform: [
          {
            translateY: transitionAnimation.value === 0 ? 0 : -20,
          },
        ],
        position: "absolute",
        width: "100%",
      };
    });

    const titleContentStyle = useAnimatedStyle(() => {
      return {
        opacity: transitionAnimation.value === 1 ? 1 : 0,
        transform: [
          {
            translateY: transitionAnimation.value === 1 ? 0 : 20,
          },
        ],
        position: "absolute",
        width: "100%",
      };
    });

    const categoryContentStyle = useAnimatedStyle(() => {
      return {
        opacity: transitionAnimation.value === 2 ? 1 : 0,
        transform: [
          {
            translateY: transitionAnimation.value === 2 ? 0 : 20,
          },
        ],
        position: "absolute",
        width: "100%",
      };
    });

    // Time calculation effect
    useEffect(() => {
      const calculateTimeLeft = () => {
        try {
          let eventDate: Date;
          let eventEndDate: Date | undefined;

          // Parse the event start date and time
          if (time.includes("@")) {
            // Format: "Sunday, April 20th, 2025 @ 1pm"
            const [datePart, timePart] = time.split("@").map((s) => s.trim());

            // Clean up the date string by removing ordinal indicators
            const cleanDateStr = datePart.replace(/(st|nd|rd|th),?/g, "");

            // Parse the date part
            const dateObj = new Date(cleanDateStr);

            // If date parsing failed, try manual parsing
            if (isNaN(dateObj.getTime())) {
              console.error("Failed to parse date:", cleanDateStr);
              throw new Error("Invalid date format");
            }

            // Parse the time part
            const isPM = timePart.toLowerCase().includes("pm");
            let hours = parseInt(timePart);
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;

            dateObj.setHours(hours, 0, 0, 0);
            eventDate = dateObj;
          } else if (time.includes("/")) {
            const [month, day, year] = time.split("/").map((num) => parseInt(num, 10));
            eventDate = new Date(year, month - 1, day, 0, 0, 0);
          } else {
            eventDate = new Date(time);
          }

          // Parse the end date if provided
          if (endDate) {
            if (endDate.includes("@")) {
              const [datePart, timePart] = endDate.split("@").map((s) => s.trim());
              const dateObj = new Date(datePart);

              const isPM = timePart.toLowerCase().includes("pm");
              let hours = parseInt(timePart);
              if (isPM && hours !== 12) hours += 12;
              if (!isPM && hours === 12) hours = 0;

              dateObj.setHours(hours, 0, 0, 0);
              eventEndDate = dateObj;
            } else if (endDate.includes("/")) {
              const [month, day, year] = endDate.split("/").map((num) => parseInt(num, 10));
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

          // If we have an end date and we're past the start date, calculate remaining time in the event
          if (eventEndDate && now > eventDate && now < eventEndDate) {
            const diff = eventEndDate.getTime() - now.getTime();
            const hours = Math.ceil(diff / (1000 * 60 * 60));
            setTimeLeft(`${hours} ${hours === 1 ? "hour" : "hours"} left`);
            setIsExpired(false);
            return;
          }

          // If we have an end date and we're past it, show expired
          if (eventEndDate && now > eventEndDate) {
            setTimeLeft("expired");
            setIsExpired(true);
            return;
          }

          // Calculate time until event starts
          const diff = eventDate.getTime() - now.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

          if (diff < 0) {
            setTimeLeft("expired");
            setIsExpired(true);
          } else if (days > 0) {
            setTimeLeft(`in ${days} ${days === 1 ? "day" : "days"}`);
            setIsExpired(false);
          } else if (hours > 0) {
            setTimeLeft(`in ${hours} ${hours === 1 ? "hour" : "hours"}`);
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
        <View style={styles.badgeContainer}>
          <Animated.View style={timeContentStyle}>
            <TimeContent timeLeft={timeLeft} isExpired={isExpired} animatedStyle={animatedStyle} />
          </Animated.View>

          <Animated.View style={titleContentStyle}>
            <TitleContent title={title} />
          </Animated.View>

          {categories.length > 0 && (
            <Animated.View style={categoryContentStyle}>
              <CategoryContent categories={categories} />
            </Animated.View>
          )}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -70,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  badgeContainer: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    width: 180,
    height: 32,
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
    minHeight: 20,
    paddingHorizontal: 4,
    width: "100%",
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
  categoryText: {
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
