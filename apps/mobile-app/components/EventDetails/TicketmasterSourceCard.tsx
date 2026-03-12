import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Svg, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  useColors,
  radius,
  spacing,
  fontSize,
  fontFamily,
  fontWeight,
  spring,
  type Colors,
} from "@/theme";
import TicketmasterSourceCardOverlay from "./TicketmasterSourceCardOverlay";

const TICKETMASTER_BLUE = "#009CDE";
const SHEEN_WIDTH = 140;
const CARD_HEIGHT = 190;
const WATERMARK_TEXT = "TICKETMASTER";
const WATERMARK_CHAR_COUNT = WATERMARK_TEXT.length;
const CHAR_WIDTH_RATIO = 0.6;

interface TicketmasterSourceCardProps {
  externalUrl?: string;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const TicketmasterSourceCard: React.FC<TicketmasterSourceCardProps> = ({
  externalUrl,
}) => {
  const colors = useColors();
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const [cardWidth, setCardWidth] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const sheenProgress = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && cardWidth === 0) {
        setCardWidth(w);
        sheenProgress.value = withDelay(
          1000,
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        );
      }
    },
    [cardWidth, sheenProgress],
  );

  const sheenStyle = useAnimatedStyle(() => {
    if (cardWidth === 0) return { transform: [{ translateX: -SHEEN_WIDTH }] };
    const translateX = interpolate(
      sheenProgress.value,
      [0, 1],
      [-SHEEN_WIDTH, cardWidth + SHEEN_WIDTH],
    );
    return { transform: [{ translateX }] };
  });

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const watermarkFontSize = useMemo(() => {
    if (cardWidth === 0) return 0;
    const diagonal = Math.sqrt(
      cardWidth * cardWidth + CARD_HEIGHT * CARD_HEIGHT,
    );
    const available = diagonal * 0.8;
    const size = (available / WATERMARK_CHAR_COUNT - 5) / CHAR_WIDTH_RATIO;
    return Math.min(Math.max(size, 16), 48);
  }, [cardWidth]);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.97, spring.press);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, spring.bouncy);
  }, [pressScale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOverlayVisible(true);
  }, []);

  return (
    <>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View
          style={[cardStyles.card, pressStyle]}
          onLayout={onLayout}
        >
          {/* Top row: source name + badge */}
          <View style={cardStyles.topRow}>
            <Text style={cardStyles.name}>Ticketmaster</Text>
            <Text style={cardStyles.badge}>Official Source</Text>
          </View>

          {/* Diagonal etched watermark */}
          {cardWidth > 0 && (
            <View style={cardStyles.watermarkContainer} pointerEvents="none">
              <Text
                style={[cardStyles.watermark, { fontSize: watermarkFontSize }]}
                numberOfLines={1}
              >
                {WATERMARK_TEXT}
              </Text>
            </View>
          )}

          {/* Bottom row: CTA hint */}
          <View style={cardStyles.bottomRow}>
            {externalUrl ? (
              <View style={cardStyles.ctaRow}>
                <Text style={cardStyles.ctaText}>Get Tickets</Text>
                <Text style={cardStyles.ctaChevron}>{"\u203A"}</Text>
              </View>
            ) : (
              <Text style={cardStyles.sourceLabel}>
                Event sourced from Ticketmaster
              </Text>
            )}
          </View>

          {/* Sheen overlay — single sweep */}
          {cardWidth > 0 && (
            <AnimatedSvg
              style={[cardStyles.sheenOverlay, sheenStyle]}
              width={SHEEN_WIDTH}
              height={CARD_HEIGHT}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id="tmSheen" x1="0" y1="0" x2="1" y2="0">
                  <Stop
                    offset="0"
                    stopColor={TICKETMASTER_BLUE}
                    stopOpacity="0"
                  />
                  <Stop
                    offset="0.5"
                    stopColor={TICKETMASTER_BLUE}
                    stopOpacity="0.07"
                  />
                  <Stop
                    offset="1"
                    stopColor={TICKETMASTER_BLUE}
                    stopOpacity="0"
                  />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={SHEEN_WIDTH}
                height={CARD_HEIGHT}
                fill="url(#tmSheen)"
              />
            </AnimatedSvg>
          )}
        </Animated.View>
      </Pressable>

      <TicketmasterSourceCardOverlay
        visible={overlayVisible}
        onDismiss={() => setOverlayVisible(false)}
        externalUrl={externalUrl}
      />
    </>
  );
};

const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      height: CARD_HEIGHT,
      width: "100%",
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: TICKETMASTER_BLUE,
      padding: spacing.md,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    name: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: TICKETMASTER_BLUE,
      letterSpacing: 1,
    },
    badge: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: TICKETMASTER_BLUE,
    },
    watermarkContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    watermark: {
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "rgba(0, 156, 222, 0.04)",
      letterSpacing: 5,
      textShadowColor: "rgba(0, 0, 0, 0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 0,
      transform: [{ rotate: "-18deg" }],
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    ctaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ctaText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: TICKETMASTER_BLUE,
      letterSpacing: 0.5,
    },
    ctaChevron: {
      fontSize: fontSize.lg,
      color: TICKETMASTER_BLUE,
      fontWeight: fontWeight.bold,
    },
    sourceLabel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
    sheenOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
    },
  });

export default TicketmasterSourceCard;
