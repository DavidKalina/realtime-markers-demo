import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Reanimated, { FadeInDown } from "react-native-reanimated";
import Screen from "@/components/Layout/Screen";
import { apiClient } from "@/services/ApiClient";
import { colors, spacing, fontFamily } from "@/theme";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";

const CHARS_PER_PAGE = 80;
const CHAR_DELAY_MS = 20;
const AUTO_ADVANCE_MS = 2500;

const BAR_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#fda4af"];

/**
 * Split text into pages on word boundaries.
 */
function splitIntoPages(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const pages: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length > maxChars && current) {
      pages.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) pages.push(current);
  return pages;
}

// --- Sub-components ---

function ZoneHeader({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={zoneStyles.container}
    >
      <Text style={zoneStyles.emoji}>{zoneStats.topEmoji}</Text>
      <Text style={zoneStyles.name}>{zoneStats.zoneName.toUpperCase()}</Text>
      <View style={zoneStyles.divider} />
      <Text style={zoneStyles.subtitle}>
        {zoneStats.eventCount === 0
          ? "No events nearby"
          : `${zoneStats.eventCount} event${zoneStats.eventCount !== 1 ? "s" : ""} nearby`}
      </Text>
    </Reanimated.View>
  );
}

function CategoryBarChart({
  breakdown,
}: {
  breakdown: AreaScanMetadata["categoryBreakdown"];
}) {
  if (breakdown.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(200)}
      style={barStyles.container}
    >
      <View style={barStyles.bar}>
        {breakdown.map((cat, i) => (
          <View
            key={cat.name}
            style={[
              barStyles.segment,
              {
                flex: cat.pct,
                backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === breakdown.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === breakdown.length - 1 ? 4 : 0,
              },
            ]}
          />
        ))}
      </View>
      <View style={barStyles.legend}>
        {breakdown.map((cat, i) => (
          <View key={cat.name} style={barStyles.legendItem}>
            <View
              style={[
                barStyles.legendDot,
                { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
              ]}
            />
            <Text style={barStyles.legendText}>
              {cat.name} {cat.pct}%
            </Text>
          </View>
        ))}
      </View>
    </Reanimated.View>
  );
}

function StatPillRow({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  const pills: { emoji: string; value: string; label: string }[] = [];

  if (zoneStats.totalViews > 0) {
    pills.push({
      emoji: "👁",
      value: formatNumber(zoneStats.totalViews),
      label: "views",
    });
  }
  if (zoneStats.totalSaves > 0) {
    pills.push({
      emoji: "💾",
      value: formatNumber(zoneStats.totalSaves),
      label: "saves",
    });
  }
  if (zoneStats.avgDistance > 0) {
    pills.push({
      emoji: "📏",
      value: `${zoneStats.avgDistance}m`,
      label: "avg",
    });
  }
  if (zoneStats.recurringCount > 0) {
    pills.push({
      emoji: "🔄",
      value: String(zoneStats.recurringCount),
      label: "recurring",
    });
  }

  if (pills.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(400)}
      style={pillStyles.row}
    >
      {pills.map((pill) => (
        <View key={pill.label} style={pillStyles.pill}>
          <Text style={pillStyles.pillEmoji}>{pill.emoji}</Text>
          <Text style={pillStyles.pillValue}>{pill.value}</Text>
          <Text style={pillStyles.pillLabel}>{pill.label}</Text>
        </View>
      ))}
    </Reanimated.View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  if (mins < 60) return mins <= 1 ? "Now" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function ZoneEncounters({
  events,
  onEventPress,
}: {
  events: AreaScanMetadata["events"];
  onEventPress: (eventId: string) => void;
}) {
  if (!events || events.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(600)}
      style={encounterStyles.container}
    >
      <Text style={encounterStyles.header}>ZONE ENCOUNTERS</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {events.map((event, i) => (
          <View key={event.id}>
            {i > 0 && <View style={encounterStyles.separator} />}
            <Pressable
              style={encounterStyles.row}
              onPress={() => onEventPress(event.id)}
            >
              <Text style={encounterStyles.emoji}>{event.emoji}</Text>
              <View style={encounterStyles.info}>
                <View style={encounterStyles.topLine}>
                  <Text style={encounterStyles.title} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={encounterStyles.timeBadge}>
                    {formatRelativeTime(event.eventDate)}
                  </Text>
                </View>
                <Text style={encounterStyles.subtitle} numberOfLines={1}>
                  {event.categoryNames.split(",")[0]?.trim() || "Event"}
                  {" · "}
                  {event.distance}m
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Reanimated.View>
  );
}

function getRadiusForZoom(zoom: number): number {
  if (zoom >= 15) return 500;
  if (zoom >= 12) return 2000;
  if (zoom >= 10) return 5000;
  return 15000;
}

// --- Main screen ---

export default function AreaScanScreen() {
  const { lat, lng, zoom } = useLocalSearchParams<{
    lat: string;
    lng: string;
    zoom: string;
  }>();
  const router = useRouter();
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const fullTextRef = useRef("");

  const [zoneStats, setZoneStats] = useState<AreaScanMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [pageComplete, setPageComplete] = useState(false);

  // Streaming refs
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  const charIndexRef = useRef(0);
  const currentPageTextRef = useRef("");

  // Blinking ▼
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // --- Fetch ---
  useEffect(() => {
    if (!lat || !lng) return;

    const radius = getRadiusForZoom(zoom ? parseFloat(zoom) : 12);

    const handle = apiClient.areaScan.streamAreaProfile(
      parseFloat(lat),
      parseFloat(lng),
      radius,
      {
        onMetadata: (meta) => setZoneStats(meta),
        onContent: (chunk) => {
          fullTextRef.current += chunk;
        },
        onDone: () => {
          setIsLoading(false);
          if (fullTextRef.current) {
            setPages(splitIntoPages(fullTextRef.current, CHARS_PER_PAGE));
          }
        },
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
        },
      },
    );
    abortRef.current = handle;

    return () => {
      handle.abort();
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [lat, lng]);

  // --- Character-by-character streaming ---
  const streamPage = useCallback((text: string) => {
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    setDisplayText("");
    setPageComplete(false);
    charIndexRef.current = 0;
    currentPageTextRef.current = text;

    const tick = () => {
      const i = charIndexRef.current;
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        charIndexRef.current = i + 1;
        if (i % 4 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
        streamTimerRef.current = setTimeout(tick, CHAR_DELAY_MS);
      } else {
        setPageComplete(true);
        streamTimerRef.current = null;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    };

    streamTimerRef.current = setTimeout(tick, 60);
  }, []);

  // Start first page
  useEffect(() => {
    if (pages.length > 0 && pageIndex === 0) {
      streamPage(pages[0]);
    }
  }, [pages, streamPage]);

  // --- Auto-advance ---
  useEffect(() => {
    if (pageComplete && pageIndex < pages.length - 1) {
      autoAdvanceRef.current = setTimeout(() => {
        const next = pageIndex + 1;
        setPageIndex(next);
        streamPage(pages[next]);
      }, AUTO_ADVANCE_MS);
      return () => {
        if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      };
    }
  }, [pageComplete, pageIndex, pages, streamPage]);

  // --- Blinking ▼ ---
  useEffect(() => {
    if (pageComplete && pageIndex < pages.length - 1) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.15,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    blinkAnim.setValue(1);
  }, [pageComplete, pageIndex, pages.length, blinkAnim]);

  // --- Tap handler ---
  const handleTap = useCallback(() => {
    // Cancel pending auto-advance
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    // Tap while streaming → skip to end
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
      setDisplayText(currentPageTextRef.current);
      setPageComplete(true);
      charIndexRef.current = currentPageTextRef.current.length;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }

    // Tap after page → advance
    if (pageComplete && pageIndex < pages.length - 1) {
      const next = pageIndex + 1;
      setPageIndex(next);
      streamPage(pages[next]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }

    // Tap on last page → back
    if (pageComplete && pageIndex >= pages.length - 1 && pages.length > 0) {
      router.back();
    }
  }, [pageComplete, pageIndex, pages, streamPage, router]);

  const isLastPage = pageIndex >= pages.length - 1;
  const showContinue = pageComplete && !isLastPage;
  const showDone = pageComplete && isLastPage && pages.length > 0;

  return (
    <Screen
      bannerTitle="Area Scan"
      onBack={() => router.back()}
      isScrollable={false}
    >
      {/* Zone Header */}
      {zoneStats && <ZoneHeader zoneStats={zoneStats} />}

      {/* Category Bar Chart */}
      {zoneStats && zoneStats.categoryBreakdown.length > 0 && (
        <CategoryBarChart breakdown={zoneStats.categoryBreakdown} />
      )}

      {/* Stat Pills */}
      {zoneStats && zoneStats.eventCount > 0 && (
        <StatPillRow zoneStats={zoneStats} />
      )}

      {/* Zone Encounters — fills remaining space above dialog */}
      {zoneStats && zoneStats.events?.length > 0 ? (
        <ZoneEncounters
          events={zoneStats.events}
          onEventPress={(eventId) =>
            router.push(`/details?eventId=${eventId}` as never)
          }
        />
      ) : (
        <View style={styles.spacer} />
      )}

      {/* Dialog box */}
      <Pressable onPress={handleTap} style={styles.bubble}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.textArea}>
            <Text style={styles.bubbleText}>{displayText}</Text>

            {showContinue && (
              <Animated.Text
                style={[styles.continueArrow, { opacity: blinkAnim }]}
              >
                ▼
              </Animated.Text>
            )}

            {showDone && <Text style={styles.doneHint}>tap to close</Text>}
          </View>
        )}
      </Pressable>
    </Screen>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  spacer: {
    flex: 1,
  },
  bubble: {
    backgroundColor: colors.bg.cardAlt,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 95,
    borderTopWidth: 1,
    borderColor: colors.border.medium,
    marginBottom: -spacing.lg,
  },
  textArea: {
    flex: 1,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fontFamily.mono,
  },
  continueArrow: {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontSize: 14,
    color: colors.accent.primary,
  },
  doneHint: {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
  },
  loadingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.disabled,
  },
  errorText: {
    fontSize: 14,
    color: colors.status.error.text,
    fontFamily: fontFamily.mono,
  },
});

const zoneStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  emoji: {
    fontSize: 32,
  },
  name: {
    fontSize: 24,
    fontFamily: fontFamily.mono,
    color: colors.accent.primary,
    letterSpacing: 2,
    fontWeight: "700",
    textAlign: "center",
  },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: colors.accent.muted,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const barStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  bar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  segment: {
    height: 8,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bg.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  pillEmoji: {
    fontSize: 12,
  },
  pillValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  pillLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const encounterStyles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  header: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  emoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
  timeBadge: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    backgroundColor: colors.bg.cardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
});
