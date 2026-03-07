import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, type Colors } from "@/theme";
import { apiClient, type AreaScanMetadata } from "@/services/ApiClient";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

interface AreaScanBottomSheetProps {
  coordinates: { lat: number; lng: number };
  onDismiss: () => void;
}

export function AreaScanBottomSheet({
  coordinates,
  onDismiss,
}: AreaScanBottomSheetProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const abortRef = useRef<{ abort: () => void } | null>(null);

  const [metadata, setMetadata] = useState<AreaScanMetadata | null>(null);
  const [profileText, setProfileText] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slide in on mount
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  // Start API call
  useEffect(() => {
    const handle = apiClient.areaScan.streamAreaProfile(
      coordinates.lat,
      coordinates.lng,
      2000,
      {
        onMetadata: (meta) => setMetadata(meta),
        onContent: (chunk) => setProfileText((prev) => prev + chunk),
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          setError(err.message);
          setIsStreaming(false);
        },
      },
    );
    abortRef.current = handle;

    return () => {
      handle.abort();
    };
  }, [coordinates.lat, coordinates.lng]);

  const dismiss = () => {
    abortRef.current?.abort();
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  // Swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={dismiss} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY }] },
        ]}
      >
        {/* Handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text style={styles.title}>Area Scan</Text>
          {metadata && (
            <Text style={styles.subtitle}>
              {metadata.eventCount === 0
                ? "No events nearby"
                : `${metadata.eventCount} event${metadata.eventCount !== 1 ? "s" : ""} nearby`}
            </Text>
          )}

          {/* Body */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.body}>
              {profileText ? (
                <Text style={styles.profileText}>{profileText}</Text>
              ) : null}
              {isStreaming && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator
                    size="small"
                    color={colors.accent.primary}
                  />
                  {!profileText && (
                    <Text style={styles.loadingText}>Scanning area...</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.secondary,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollInner: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    marginBottom: 16,
  },
  body: {
    marginTop: 8,
  },
  profileText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    padding: 16,
    marginTop: 8,
    backgroundColor: colors.status.error.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.status.error.border,
  },
  errorText: {
    fontSize: 14,
    color: colors.status.error.text,
  },
});
