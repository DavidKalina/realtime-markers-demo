import React, { useCallback, useMemo } from "react";
import {
  Dimensions,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
import { useDeviceMotionTilt } from "./useDeviceMotionTilt";

const TICKETMASTER_BLUE = "#009CDE";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_ASPECT = 1.586; // Credit card ratio
const OVERLAY_CARD_WIDTH = SCREEN_WIDTH * 0.85;
const OVERLAY_CARD_HEIGHT = OVERLAY_CARD_WIDTH / CARD_ASPECT;
const SHEEN_WIDTH = 140;

const WATERMARK_TEXT = "TICKETMASTER";
const WATERMARK_CHAR_COUNT = WATERMARK_TEXT.length;
const CHAR_WIDTH_RATIO = 0.6;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface TicketmasterSourceCardOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  externalUrl?: string;
}

const TicketmasterSourceCardOverlay: React.FC<
  TicketmasterSourceCardOverlayProps
> = ({ visible, onDismiss, externalUrl }) => {
  const colors = useColors();
  const overlayStyles = useMemo(() => createOverlayStyles(colors), [colors]);
  const scrimOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);

  const { rotateX, rotateY, sheenTranslateX } = useDeviceMotionTilt(visible);

  const watermarkFontSize = (() => {
    const diagonal = Math.sqrt(
      OVERLAY_CARD_WIDTH * OVERLAY_CARD_WIDTH +
        OVERLAY_CARD_HEIGHT * OVERLAY_CARD_HEIGHT,
    );
    const available = diagonal * 0.8;
    const size = (available / WATERMARK_CHAR_COUNT - 5) / CHAR_WIDTH_RATIO;
    return Math.min(Math.max(size, 16), 48);
  })();

  const onShow = useCallback(() => {
    scrimOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withSpring(1, spring.firm);
    cardOpacity.value = withTiming(1, { duration: 200 });
  }, [scrimOpacity, cardScale, cardOpacity]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withSpring(0.85, spring.firm);
    cardOpacity.value = withTiming(0, { duration: 200 });
    scrimOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  }, [cardScale, cardOpacity, scrimOpacity, onDismiss]);

  const handleGetTickets = useCallback(() => {
    if (externalUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(externalUrl);
    }
  }, [externalUrl]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${-rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  const sheenTiltStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      sheenTranslateX.value,
      [-15, 15],
      [-SHEEN_WIDTH, OVERLAY_CARD_WIDTH + SHEEN_WIDTH],
    );
    return { transform: [{ translateX }] };
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      onShow={onShow}
      onRequestClose={handleDismiss}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
        <Animated.View style={[overlayStyles.scrim, scrimStyle]} />
      </Pressable>

      {/* Centered card */}
      <View style={overlayStyles.centerContainer} pointerEvents="box-none">
        <Animated.View style={entranceStyle}>
          <Animated.View style={tiltStyle}>
            <View style={overlayStyles.cardFace}>
              {/* Top row */}
              <View style={overlayStyles.topRow}>
                <Text style={overlayStyles.name}>Ticketmaster</Text>
                <Text style={overlayStyles.badge}>Official Source</Text>
              </View>

              {/* Watermark */}
              <View
                style={overlayStyles.watermarkContainer}
                pointerEvents="none"
              >
                <Text
                  style={[
                    overlayStyles.watermark,
                    { fontSize: watermarkFontSize },
                  ]}
                  numberOfLines={1}
                >
                  {WATERMARK_TEXT}
                </Text>
              </View>

              {/* Bottom row */}
              <View style={overlayStyles.bottomRow}>
                {externalUrl ? (
                  <TouchableOpacity
                    onPress={handleGetTickets}
                    activeOpacity={0.7}
                    style={overlayStyles.ctaButton}
                  >
                    <Text style={overlayStyles.ctaText}>Get Tickets</Text>
                    <Text style={overlayStyles.ctaChevron}>{"\u203A"}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={overlayStyles.sourceLabel}>
                    Event sourced from Ticketmaster
                  </Text>
                )}
              </View>

              {/* Tilt-driven sheen */}
              <AnimatedSvg
                style={[overlayStyles.sheenOverlay, sheenTiltStyle]}
                width={SHEEN_WIDTH}
                height={OVERLAY_CARD_HEIGHT}
                pointerEvents="none"
              >
                <Defs>
                  <LinearGradient
                    id="tmOverlaySheen"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <Stop
                      offset="0"
                      stopColor={TICKETMASTER_BLUE}
                      stopOpacity="0"
                    />
                    <Stop
                      offset="0.5"
                      stopColor={TICKETMASTER_BLUE}
                      stopOpacity="0.12"
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
                  height={OVERLAY_CARD_HEIGHT}
                  fill="url(#tmOverlaySheen)"
                />
              </AnimatedSvg>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createOverlayStyles = (colors: Colors) => StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cardFace: {
    width: OVERLAY_CARD_WIDTH,
    height: OVERLAY_CARD_HEIGHT,
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
  name: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    color: TICKETMASTER_BLUE,
    letterSpacing: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TICKETMASTER_BLUE,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  ctaText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    color: colors.fixed.white,
    letterSpacing: 0.5,
  },
  ctaChevron: {
    fontSize: fontSize.lg,
    color: colors.fixed.white,
    fontWeight: fontWeight.bold,
  },
  sourceLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.disabled,
    letterSpacing: 1,
  },
  sheenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});

export default TicketmasterSourceCardOverlay;
