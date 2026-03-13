import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  useColors,
  fontFamily,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { pushNotificationService } from "@/services/PushNotificationService";
import { useAuth } from "@/contexts/AuthContext";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import type { RitualResponse } from "@/services/api/modules/rituals";
import type { NearbyPlace } from "@/services/api/modules/places";
import { useRouter } from "expo-router";
import { useJobProgress } from "@/hooks/useJobProgress";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import useThirdSpaces from "@/hooks/useThirdSpaces";
import { useUserLocation } from "@/contexts/LocationContext";
import ItineraryTimeline from "./ItineraryTimeline";

/* ── Collapsible section ─────────────────────────────────── */
const COLLAPSE_DURATION = 250;

interface CollapsibleSectionHandle {
  expand: () => void;
}

const CollapsibleSection = forwardRef<
  CollapsibleSectionHandle,
  {
    title: string;
    defaultExpanded?: boolean;
    colors: Colors;
    children: React.ReactNode;
  }
>(function CollapsibleSection(
  { title, defaultExpanded = false, colors, children },
  ref,
) {
  const expanded = useSharedValue(defaultExpanded ? 1 : 0);
  const contentHeight = useSharedValue(0);
  const sStyles = useMemo(() => collapsibleStyles(colors), [colors]);

  useImperativeHandle(ref, () => ({
    expand: () => {
      if (expanded.value < 1) {
        expanded.value = withTiming(1, {
          duration: COLLAPSE_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
  }));

  const toggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    expanded.value = withTiming(expanded.value === 1 ? 0 : 1, {
      duration: COLLAPSE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      contentHeight.value = h;
    }
  }, []);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expanded.value * 90}deg` }],
  }));

  const bodyStyle = useAnimatedStyle(() => {
    // Before measurement, show at natural height if default-expanded
    if (contentHeight.value === 0) {
      return expanded.value === 1 ? { opacity: 1 } : { height: 0, opacity: 0 };
    }
    const h = interpolate(expanded.value, [0, 1], [0, contentHeight.value]);
    return { height: h, opacity: expanded.value };
  });

  return (
    <View style={sStyles.wrapper}>
      <Pressable onPress={toggle} style={sStyles.header}>
        <Text style={sStyles.label}>{title}</Text>
        <Reanimated.View style={chevronStyle}>
          <Text style={sStyles.chevron}>›</Text>
        </Reanimated.View>
      </Pressable>

      {/* Always-present invisible measure — ensures contentHeight is known even when collapsed */}
      <View
        style={sStyles.measure}
        onLayout={onContentLayout}
        pointerEvents="none"
      >
        <View style={sStyles.content}>{children}</View>
      </View>

      {/* Animated clip container — always rendered, no conditional swap */}
      <Reanimated.View style={[sStyles.bodyClip, bodyStyle]}>
        <View style={sStyles.content}>{children}</View>
      </Reanimated.View>
    </View>
  );
});

const collapsibleStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      marginTop: spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    chevron: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: "700",
    },
    measure: {
      position: "absolute",
      opacity: 0,
      left: 0,
      right: 0,
    },
    bodyClip: {
      overflow: "hidden",
    },
    content: {
      marginTop: 6,
    },
  });

/* ── Budget slider ───────────────────────────────────────── */
const SLIDER_TRACK_HEIGHT = 6;
const SLIDER_THUMB_SIZE = 24;

function BudgetSlider({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: Colors;
}) {
  const trackWidth = useRef(0);
  const trackX = useRef(0);
  const bStyles = useMemo(() => budgetSliderStyles(colors), [colors]);

  const fraction = (value - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    // Measure absolute X so touches are relative to the track
    (
      e.target as unknown as {
        measureInWindow: (cb: (x: number) => void) => void;
      }
    ).measureInWindow((x: number) => {
      trackX.current = x;
    });
  }, []);

  const clampToStep = useCallback((pageX: number) => {
    const relX = pageX - trackX.current;
    const pct = Math.max(0, Math.min(1, relX / trackWidth.current));
    const raw = BUDGET_MIN + pct * (BUDGET_MAX - BUDGET_MIN);
    const stepped = Math.round(raw / BUDGET_STEP) * BUDGET_STEP;
    return Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, stepped));
  }, []);

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      const next = clampToStep(e.nativeEvent.pageX);
      if (next !== value) {
        Haptics.selectionAsync();
        onChange(next);
      }
    },
    [value, onChange, clampToStep],
  );

  return (
    <View style={bStyles.wrapper}>
      <View
        style={bStyles.track}
        onLayout={onTrackLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View style={bStyles.trackBg} />
        <View style={[bStyles.trackFill, { width: `${fraction * 100}%` }]} />
        <View
          style={[
            bStyles.thumb,
            { left: `${fraction * 100}%`, marginLeft: -SLIDER_THUMB_SIZE / 2 },
          ]}
        />
      </View>
      <View style={bStyles.labels}>
        <Text style={bStyles.labelText}>Free</Text>
        <Text style={bStyles.labelText}>${BUDGET_MAX}</Text>
      </View>
    </View>
  );
}

const budgetSliderStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: {
      paddingVertical: 8,
    },
    track: {
      height: SLIDER_THUMB_SIZE,
      justifyContent: "center",
      marginHorizontal: SLIDER_THUMB_SIZE / 2,
    },
    trackBg: {
      position: "absolute",
      left: 0,
      right: 0,
      height: SLIDER_TRACK_HEIGHT,
      borderRadius: SLIDER_TRACK_HEIGHT / 2,
      backgroundColor: colors.bg.elevated,
      top: (SLIDER_THUMB_SIZE - SLIDER_TRACK_HEIGHT) / 2,
    },
    trackFill: {
      position: "absolute",
      left: 0,
      height: SLIDER_TRACK_HEIGHT,
      borderRadius: SLIDER_TRACK_HEIGHT / 2,
      backgroundColor: GREEN_ACCENT,
      top: (SLIDER_THUMB_SIZE - SLIDER_TRACK_HEIGHT) / 2,
    },
    thumb: {
      position: "absolute",
      width: SLIDER_THUMB_SIZE,
      height: SLIDER_THUMB_SIZE,
      borderRadius: SLIDER_THUMB_SIZE / 2,
      backgroundColor: GREEN_ACCENT,
      borderWidth: 2,
      borderColor: colors.bg.card,
    },
    labels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    labelText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
  });

// Map dominant condition string to emoji
function conditionEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("thunder")) return "\u26C8\uFE0F";
  if (c.includes("snow") || c.includes("sleet")) return "\u2744\uFE0F";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower"))
    return "\uD83C\uDF27\uFE0F";
  if (c.includes("fog") || c.includes("mist")) return "\uD83C\uDF2B\uFE0F";
  if (c.includes("partly") || c.includes("partial")) return "\u26C5";
  if (c.includes("cloud") || c.includes("overcast")) return "\u2601\uFE0F";
  if (c.includes("clear") || c.includes("sunny")) return "\u2600\uFE0F";
  return "\uD83C\uDF24\uFE0F";
}

const COLLAPSED_HEIGHT = 44;
const SHEEN_WIDTH = 100;
const EXPANDED_FORM_HEIGHT = 620;
const EXPANDED_RESULT_HEIGHT = 620;

// Matches ThirdSpaceScoreHero green palette
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

const ACTIVITY_OPTIONS = [
  { label: "Food", value: "food", emoji: "\u{1F37D}\uFE0F" },
  { label: "Coffee", value: "coffee", emoji: "\u2615" },
  { label: "Music", value: "music", emoji: "\u{1F3B5}" },
  { label: "Art", value: "art", emoji: "\u{1F3A8}" },
  { label: "Outdoors", value: "outdoors", emoji: "\u{1F333}" },
  { label: "Boarding", value: "boarding", emoji: "\u{1F6F9}" },
  { label: "Hiking", value: "hiking", emoji: "\u{1F97E}" },
  { label: "Walking", value: "walking", emoji: "\u{1F6B6}" },
  { label: "Nightlife", value: "nightlife", emoji: "\u{1F378}" },
  { label: "Sports", value: "sports", emoji: "\u26BD" },
  { label: "Culture", value: "culture", emoji: "\u{1F3DB}\uFE0F" },
];

const INTENTION_OPTIONS = [
  { label: "Recharge", value: "recharge", emoji: "\u{1F9D8}" },
  { label: "Explore", value: "explore", emoji: "\u{1F9ED}" },
  { label: "Socialize", value: "socialize", emoji: "\u{1F37B}" },
  { label: "Move", value: "move", emoji: "\u{1F3C3}" },
  { label: "Learn", value: "learn", emoji: "\u{1F4DA}" },
  { label: "Treat Yourself", value: "treat_yourself", emoji: "\u{1F48E}" },
];

const STOP_COUNT_OPTIONS = [
  { label: "Auto", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
];

const DURATION_OPTIONS = [
  { label: "2h", value: 2 },
  { label: "4h", value: 4 },
  { label: "Half day", value: 6 },
  { label: "Full day", value: 10 },
];

const TIME_HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5am – 10pm

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

const BUDGET_MIN = 0;
const BUDGET_MAX = 200;
const BUDGET_STEP = 5;

const EXPANDED_NEARBY_HEIGHT = 160;

type Phase = "collapsed" | "nearby" | "form" | "generating" | "result";

export interface AnchorStopInput {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  label?: string;
  address?: string;
  placeId?: string;
  primaryType?: string;
  rating?: number;
}

interface NearbyPlacesInput {
  lat: number;
  lng: number;
  zoom?: number;
  /** placeId of the anchor being edited — pre-selects in the nearby list */
  selectedPlaceId?: string;
}

interface ItineraryDialogBoxProps {
  city?: string;
  style?: ViewStyle;
  onDismiss?: () => void;
  /** Start expanded in form mode (used on itineraries list screen) */
  defaultExpanded?: boolean;
  /** Anchor stops from map planning mode */
  anchorStops?: AnchorStopInput[];
  /** Callback when itinerary result arrives — used for route overlay */
  onItineraryResult?: (
    items: { latitude?: number; longitude?: number }[],
  ) => void;
  /** When set, shows the nearby places picker phase */
  nearbyPlaces?: NearbyPlacesInput | null;
  /** Called when user picks a nearby place */
  onNearbySelect?: (place: NearbyPlace) => void;
  /** Called when user keeps the raw pin */
  onNearbyKeepPin?: () => void;
  /** Called when user dismisses the nearby sheet (remove pin) */
  onNearbyDismiss?: () => void;
  /** Fly the map camera to coordinates (map screen only) */
  onFlyTo?: (coords: [number, number]) => void;
  /** Create an anchor from a searched place (map screen only) */
  onSearchPlaceAnchor?: (place: {
    coordinates: [number, number];
    name: string;
    address: string;
    placeId: string;
    primaryType?: string;
    rating?: number;
  }) => void;
  /** Called when user taps an anchor chip to edit it */
  onAnchorEdit?: (anchorId: string) => void;
  /** Called when user removes an anchor stop */
  onAnchorRemove?: (anchorId: string) => void;
}

export default function ItineraryDialogBox({
  city: cityProp,
  style,
  onDismiss,
  defaultExpanded = false,
  anchorStops,
  onItineraryResult,
  nearbyPlaces,
  onNearbySelect,
  onNearbyKeepPin,
  onNearbyDismiss,
  onFlyTo,
  onSearchPlaceAnchor,
  onAnchorEdit,
  onAnchorRemove,
}: ItineraryDialogBoxProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>(
    defaultExpanded ? "form" : "collapsed",
  );
  const [statusText, setStatusText] = useState("Plan your adventure");

  // City state — chip picker when no city prop provided
  const { userLocation } = useUserLocation();
  const { closestCities, topCities } = useThirdSpaces(
    cityProp ? undefined : userLocation?.[1],
    cityProp ? undefined : userLocation?.[0],
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const city = cityProp ?? selectedCity ?? "";

  // Build deduplicated city list: closest first, then top
  const cityOptions = useMemo(() => {
    if (cityProp) return [];
    const seen = new Set<string>();
    const result: { city: string; label: string; distanceMiles?: number }[] =
      [];
    for (const c of closestCities) {
      if (!seen.has(c.city)) {
        seen.add(c.city);
        const shortName = c.city.split(",")[0].trim();
        result.push({
          city: c.city,
          label: c.distanceMiles
            ? `${shortName} · ${Math.round(c.distanceMiles)}mi`
            : shortName,
          distanceMiles: c.distanceMiles,
        });
      }
    }
    for (const c of topCities) {
      if (!seen.has(c.city)) {
        seen.add(c.city);
        result.push({ city: c.city, label: c.city.split(",")[0].trim() });
      }
    }
    return result.slice(0, 10);
  }, [cityProp, closestCities, topCities]);

  // Form state — no defaults so user must pick each via auto-expand flow
  const [plannedDate, setPlannedDate] = useState<string | null>(null);
  const [budgetMax, setBudgetMax] = useState(0);
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [stopCount, setStopCount] = useState<number | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedIntention, setSelectedIntention] = useState<string | null>(
    null,
  );
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(13);
  const [result, setResult] = useState<ItineraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const resultScrollRef = useRef<ScrollView>(null);

  // Nearby places state
  const [nearbyResults, setNearbyResults] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedNearbyPlaceId, setSelectedNearbyPlaceId] = useState<
    string | null
  >(null);

  // Place search state (for anchor planning from map)
  const canSearch = Boolean(onFlyTo || onSearchPlaceAnchor);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    name: string;
    address: string;
    coordinates: [number, number];
    placeId: string;
    primaryType?: string;
    rating?: number;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced place search
  useEffect(() => {
    if (!canSearch || searchQuery.length < 3) {
      setSearchResult(null);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchLoading(true);
      const coords = userLocation
        ? { lat: userLocation[1], lng: userLocation[0] }
        : undefined;
      apiClient.places
        .searchPlace({ query: searchQuery, coordinates: coords })
        .then((res) => {
          if (res.success && res.place) {
            setSearchResult({
              name: res.place.name,
              address: res.place.address,
              coordinates: res.place.coordinates,
              placeId: res.place.placeId,
              primaryType: res.place.types?.[0],
              rating: res.place.rating,
            });
          } else {
            setSearchResult(null);
          }
        })
        .catch(() => setSearchResult(null))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, canSearch, userLocation]);

  const handleSearchDropPin = useCallback(() => {
    if (!searchResult?.coordinates) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = searchResult;
      setSearchQuery("");
      setSearchResult(null);
      onFlyTo?.(result.coordinates);
      onSearchPlaceAnchor?.(result);
    } catch (error) {
      console.error("[ItineraryDialogBox] Drop pin failed:", error);
    }
  }, [searchResult, onFlyTo, onSearchPlaceAnchor]);

  const handleSearchFlyTo = useCallback(() => {
    if (!searchResult?.coordinates) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const coords = searchResult.coordinates;
      setSearchQuery("");
      setSearchResult(null);
      onFlyTo?.(coords);
    } catch (error) {
      console.error("[ItineraryDialogBox] Fly-to failed:", error);
    }
  }, [searchResult, onFlyTo]);

  const prevNearbyRef = useRef<NearbyPlacesInput | null>(null);

  const handleNearbySelectInternal = useCallback(
    (place: NearbyPlace) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedNearbyPlaceId(place.placeId);
      onNearbySelect?.(place);
    },
    [onNearbySelect],
  );

  // Section refs for auto-expand
  const howLongRef = useRef<CollapsibleSectionHandle>(null);
  const stopsRef = useRef<CollapsibleSectionHandle>(null);
  const budgetRef = useRef<CollapsibleSectionHandle>(null);
  const vibesRef = useRef<CollapsibleSectionHandle>(null);
  const intentionRef = useRef<CollapsibleSectionHandle>(null);

  // Rituals
  const [rituals, setRituals] = useState<RitualResponse[]>([]);
  const [activeRitualId, setActiveRitualId] = useState<string | null>(null);

  // Job progress streaming
  const { activeJobs, trackJob } = useJobProgress();
  const itineraryJobStore = useItineraryJobStore();
  const trackedJob = activeJobId
    ? activeJobs.find((j) => j.jobId === activeJobId)
    : null;

  const setPhaseFormCb = useCallback(() => setPhase("form"), []);
  const setPhaseResultCb = useCallback(() => setPhase("result"), []);

  const onDismissRef = useRef<{ fn: typeof onDismiss }>({ fn: onDismiss });
  onDismissRef.current.fn = onDismiss;

  const resultRef = useRef<{ val: ItineraryResponse | null }>({ val: null });
  resultRef.current.val = result;

  const setCollapsedStatusCb = useCallback(() => {
    setPhase("collapsed");
    setStatusText(
      resultRef.current.val ? "View itinerary" : "Plan your adventure",
    );
  }, []);

  const setReExpandPhaseCb = useCallback(() => {
    setPhase(resultRef.current.val ? "result" : "form");
  }, []);

  // Animation shared values
  const animHeight = useSharedValue(
    defaultExpanded ? EXPANDED_FORM_HEIGHT : COLLAPSED_HEIGHT,
  );
  const sheenPos = useSharedValue(0);
  const contentOpacity = useSharedValue(defaultExpanded ? 1 : 0);
  const statusOpacity = useSharedValue(defaultExpanded ? 0 : 1);
  const sheenActive = useSharedValue(defaultExpanded ? 0 : 1);
  const [containerMeasured, setContainerMeasured] = useState(false);
  const containerWidthSV = useSharedValue(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, []);

  // Transition into nearby phase when nearbyPlaces prop appears
  const setPhaseNearbyCb = useCallback(() => {
    setPhase("nearby");
  }, []);

  useEffect(() => {
    const prev = prevNearbyRef.current;
    prevNearbyRef.current = nearbyPlaces ?? null;

    if (
      nearbyPlaces &&
      (!prev || prev.lat !== nearbyPlaces.lat || prev.lng !== nearbyPlaces.lng)
    ) {
      // Reset state up-front so the animation callback can't clobber fetch results
      setNearbyResults([]);
      setNearbyLoading(true);
      setSelectedNearbyPlaceId(nearbyPlaces.selectedPlaceId ?? null);

      // Entering nearby phase
      cancelAnimation(sheenPos);
      cancelAnimation(animHeight);
      sheenActive.value = 0;
      statusOpacity.value = withTiming(0, { duration: 150 });
      contentOpacity.value = withTiming(0, { duration: 100 });
      animHeight.value = withTiming(
        EXPANDED_NEARBY_HEIGHT,
        { duration: 350, easing: Easing.out(Easing.cubic) },
        (fin) => {
          if (fin) {
            scheduleOnRN(setPhaseNearbyCb);
            contentOpacity.value = withTiming(1, { duration: 200 });
          }
        },
      );

      // Fetch nearby places — scale radius with zoom level so low-zoom
      // long-presses cast a wider net (max 5000m at zoom ≤6, 500m at zoom ≥16).
      const zoom = nearbyPlaces.zoom ?? 16;
      const radius = Math.round(
        Math.min(
          5000,
          Math.max(500, 500 * Math.pow(2, Math.max(0, 16 - zoom) / 2)),
        ),
      );
      let cancelled = false;
      apiClient.places
        .searchNearby(
          nearbyPlaces.lat,
          nearbyPlaces.lng,
          radius,
          zoom >= 14 ? 8 : zoom >= 10 ? 12 : 16,
        )
        .then((res) => {
          if (!cancelled && res.success) {
            setNearbyResults(res.places);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setNearbyLoading(false);
        });

      return () => {
        cancelled = true;
      };
    } else if (!nearbyPlaces && prev) {
      // Exiting nearby phase — go to collapsed
      cancelAnimation(animHeight);
      contentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(
        COLLAPSED_HEIGHT,
        { duration: 300, easing: Easing.out(Easing.cubic) },
        (fin) => {
          if (fin) {
            scheduleOnRN(setCollapsedStatusCb);
            statusOpacity.value = withTiming(1, { duration: 200 });
          }
        },
      );
    }
  }, [nearbyPlaces?.lat, nearbyPlaces?.lng]);

  // Periodic sheen to draw attention while collapsed
  useEffect(() => {
    if (phase !== "collapsed") return;

    const runSheen = () => {
      sheenActive.value = 1;
      sheenPos.value = 0;
      sheenPos.value = withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      });
    };

    // Initial sheen after a short delay
    const initialTimeout = setTimeout(runSheen, 1500);

    // Repeat every 15 seconds
    const interval = setInterval(runSheen, 15000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [phase]);

  // Watch job progress for status text updates and completion
  useEffect(() => {
    if (!trackedJob || !activeJobId) return;

    if (trackedJob.status === "processing" || trackedJob.status === "pending") {
      const label = trackedJob.stepLabel || "Crafting your day...";
      setStatusText(label);
      itineraryJobStore.updateStep(label);
    }

    if (trackedJob.status === "completed") {
      const itineraryId = (trackedJob.result as { itineraryId?: string })
        ?.itineraryId;
      if (!itineraryId) return;

      // Fetch the completed itinerary
      apiClient.itineraries
        .getById(itineraryId)
        .then((itinerary) => {
          setResult(itinerary);
          resultRef.current.val = itinerary;
          setActiveJobId(null);
          itineraryJobStore.completeJob();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (onItineraryResult && itinerary.items) {
            onItineraryResult(itinerary.items);
          }

          // Prompt for notification permission after first itinerary creation
          if (user?.id) {
            pushNotificationService
              .setupPushNotifications(user.id)
              .catch(() => {});
          }

          // Expand to show result
          cancelAnimation(sheenPos);
          setStatusText("Your itinerary is ready");
          sheenPos.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(
              1,
              { duration: 600, easing: Easing.inOut(Easing.ease) },
              (fin) => {
                if (!fin) return;
                sheenActive.value = 0;
                statusOpacity.value = withTiming(0, { duration: 200 });
                animHeight.value = withTiming(
                  EXPANDED_RESULT_HEIGHT,
                  { duration: 400, easing: Easing.out(Easing.cubic) },
                  (fin2) => {
                    if (!fin2) return;
                    scheduleOnRN(setPhaseResultCb);
                    contentOpacity.value = withTiming(1, { duration: 250 });
                  },
                );
              },
            ),
          );
        })
        .catch((err) => {
          console.error("[ItineraryDialogBox] Failed to fetch itinerary:", err);
          cancelAnimation(sheenPos);
          sheenActive.value = 0;
          setError("Failed to load itinerary");
          setPhase("form");
          setActiveJobId(null);
          itineraryJobStore.failJob();
          statusOpacity.value = withTiming(0, { duration: 150 });
          animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
          });
          contentOpacity.value = withDelay(
            150,
            withTiming(1, { duration: 200 }),
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    }

    if (trackedJob.status === "failed") {
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      setError(trackedJob.error || "Failed to generate itinerary");
      setPhase("form");
      setActiveJobId(null);
      itineraryJobStore.failJob();
      statusOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [trackedJob?.status, trackedJob?.stepLabel, activeJobId]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contentOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(
      COLLAPSED_HEIGHT,
      { duration: 350, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setCollapsedStatusCb);
          statusOpacity.value = withTiming(1, { duration: 200 });
        }
      },
    );
  }, [setCollapsedStatusCb]);

  const handleReExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Stop any in-progress sheen and pick up from its current position
    cancelAnimation(sheenPos);
    const current = sheenPos.value;
    const remaining = 1 - current;
    const duration = Math.max(150, remaining * 600);

    sheenActive.value = 1;
    sheenPos.value = withTiming(
      1,
      { duration, easing: Easing.inOut(Easing.ease) },
      (fin) => {
        if (!fin) return;
        sheenActive.value = 0;
        statusOpacity.value = withTiming(0, { duration: 150 });
        const targetH = resultRef.current.val
          ? EXPANDED_RESULT_HEIGHT
          : EXPANDED_FORM_HEIGHT;
        animHeight.value = withTiming(
          targetH,
          { duration: 350, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) {
              scheduleOnRN(setReExpandPhaseCb);
              contentOpacity.value = withDelay(
                50,
                withTiming(1, { duration: 200 }),
              );
            }
          },
        );
      },
    );
  }, [setReExpandPhaseCb]);

  // Load rituals
  useEffect(() => {
    apiClient.rituals
      .list()
      .then((r) => setRituals(r))
      .catch((err) =>
        console.warn("[ItineraryDialogBox] Failed to load rituals:", err),
      );
  }, []);

  const toggleActivity = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedActivities((prev) => {
      const wasEmpty = prev.length === 0;
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      // Auto-expand intention section when first vibe is selected
      if (wasEmpty && next.length > 0) {
        intentionRef.current?.expand();
      }
      return next;
    });
  }, []);

  const applyRitual = useCallback((ritual: RitualResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveRitualId(ritual.id);
    setBudgetMax(Number(ritual.budgetMax));
    setDurationHours(Number(ritual.durationHours));
    setStopCount(ritual.stopCount);
    setSelectedActivities(ritual.activityTypes);
  }, []);

  // Fire-and-forget generate with explicit params (avoids stale closure from setState)
  const fireGenerate = useCallback(
    async (params: {
      duration: number;
      stops: number;
      activities: string[];
      budget: number;
      ritualId?: string;
      startTime?: string;
      endTime?: string;
      intention?: string;
    }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPhase("generating");
      setError(null);
      setStatusText("Crafting your day...");

      contentOpacity.value = withTiming(0, { duration: 150 });
      statusOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
      sheenActive.value = 1;
      sheenPos.value = 0;
      sheenPos.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      animHeight.value = withTiming(COLLAPSED_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });

      try {
        const { jobId } = await apiClient.itineraries.create({
          city: city || undefined,
          plannedDate: plannedDate ?? new Date().toISOString().split("T")[0],
          budgetMin: 0,
          budgetMax: params.budget,
          durationHours: params.duration,
          activityTypes: params.activities,
          stopCount: params.stops || undefined,
          ritualId: params.ritualId,
          ...(params.intention && { intention: params.intention }),
          ...(params.startTime && { startTime: params.startTime }),
          ...(params.endTime && { endTime: params.endTime }),
          ...(anchorStops &&
            anchorStops.length > 0 && {
              anchorStops: anchorStops.map((a) => ({
                coordinates: a.coordinates,
                label: a.label,
                address: a.address,
                placeId: a.placeId,
                primaryType: a.primaryType,
                rating: a.rating,
              })),
            }),
        });
        setActiveJobId(jobId);
        trackJob(jobId);
        itineraryJobStore.startJob(jobId);
      } catch (err) {
        cancelAnimation(sheenPos);
        sheenActive.value = 0;
        setError(err instanceof Error ? err.message : "Failed to generate");
        setPhase("form");
        statusOpacity.value = withTiming(0, { duration: 150 });
        animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [city, plannedDate, trackJob, anchorStops],
  );

  const hasAnchors = anchorStops && anchorStops.length > 0;

  const handleGenerate = useCallback(() => {
    if (!city && !hasAnchors) {
      setError("Please select a city");
      return;
    }
    const duration = useCustomTime
      ? Math.max(1, endHour - startHour)
      : (durationHours ?? 4);
    fireGenerate({
      duration,
      stops: stopCount ?? 0,
      activities: selectedActivities,
      budget: budgetMax,
      ritualId: activeRitualId ?? undefined,
      intention: selectedIntention ?? undefined,
      ...(useCustomTime && {
        startTime: `${String(startHour).padStart(2, "0")}:00`,
        endTime: `${String(endHour).padStart(2, "0")}:00`,
      }),
    });
  }, [
    city,
    hasAnchors,
    durationHours,
    stopCount,
    selectedActivities,
    budgetMax,
    activeRitualId,
    selectedIntention,
    useCustomTime,
    startHour,
    endHour,
    fireGenerate,
  ]);

  const handleSurpriseMe = useCallback(() => {
    if (!city && !hasAnchors) {
      setError("Please select a city");
      return;
    }
    const randomDuration =
      DURATION_OPTIONS[Math.floor(Math.random() * DURATION_OPTIONS.length)]
        .value;
    const randomStops = [3, 4, 5, 6][Math.floor(Math.random() * 4)];
    const shuffledActivities = [...ACTIVITY_OPTIONS].sort(
      () => Math.random() - 0.5,
    );
    const randomActivities = shuffledActivities
      .slice(0, 2 + Math.floor(Math.random() * 2))
      .map((a) => a.value);
    const randomBudget = [30, 50, 75, 100][Math.floor(Math.random() * 4)];

    // Update form visuals (won't matter since it collapses, but keeps state consistent)
    setDurationHours(randomDuration);
    setStopCount(randomStops);
    setSelectedActivities(randomActivities);
    setBudgetMax(randomBudget);

    fireGenerate({
      duration: randomDuration,
      stops: randomStops,
      activities: randomActivities,
      budget: randomBudget,
    });
  }, [city, hasAnchors, fireGenerate]);

  const handleReset = useCallback(() => {
    setResult(null);
    resultRef.current.val = null;
    setError(null);
    contentOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(
      EXPANDED_FORM_HEIGHT,
      { duration: 300, easing: Easing.out(Easing.cubic) },
      (fin) => {
        if (fin) {
          scheduleOnRN(setPhaseFormCb);
          contentOpacity.value = withDelay(
            50,
            withTiming(1, { duration: 200 }),
          );
        }
      },
    );
  }, [setPhaseFormCb]);

  // Date options
  const dateOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const value = d.toISOString().split("T")[0];
      const label =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
      options.push({ label, value });
    }
    return options;
  }, []);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  const sheenAnimStyle = useAnimatedStyle(() => {
    if (sheenActive.value === 0) return { opacity: 0 };
    const translateX =
      containerWidthSV.value > 0
        ? interpolate(
            sheenPos.value,
            [0, 1],
            [-SHEEN_WIDTH, containerWidthSV.value + SHEEN_WIDTH],
          )
        : -SHEEN_WIDTH;
    const opacity = interpolate(
      sheenPos.value,
      [0, 0.05, 0.95, 1],
      [0, 0.8, 0.8, 0],
    );
    return { opacity, transform: [{ translateX }] };
  });

  const statusAnimStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Reanimated.View
      style={[styles.bubble, style, animatedContainerStyle]}
      onLayout={handleLayout}
    >
      {/* Status text overlay (collapsed / generating) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={phase === "collapsed" ? handleReExpand : undefined}
      >
        <Reanimated.View
          style={[styles.statusOverlay, statusAnimStyle]}
          pointerEvents="none"
        >
          <Text style={styles.statusText}>{statusText}</Text>
        </Reanimated.View>
      </Pressable>

      {/* Sheen sweep */}
      {containerMeasured && (
        <Reanimated.View
          style={[styles.sheenBeam, sheenAnimStyle]}
          pointerEvents="none"
        >
          <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
            <Defs>
              <LinearGradient id="itSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#86efac" stopOpacity="0" />
                <Stop offset="0.3" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="0.5" stopColor="#d4f5e0" stopOpacity="0.5" />
                <Stop offset="0.7" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#86efac" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={SHEEN_WIDTH}
              height={COLLAPSED_HEIGHT}
              fill="url(#itSheen)"
            />
          </Svg>
        </Reanimated.View>
      )}

      {/* Content */}
      <Reanimated.View style={[{ flex: 1 }, contentAnimStyle]}>
        {/* Inline header with dismiss */}
        {(phase === "form" || phase === "result" || phase === "nearby") && (
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {phase === "result"
                ? "Your Plan"
                : phase === "nearby"
                  ? "What's Here?"
                  : "Plan Your Adventure"}
            </Text>
            <Pressable
              onPress={phase === "nearby" ? onNearbyKeepPin : handleDismiss}
              style={styles.dismissButton}
            >
              <Text style={styles.dismissText}>✕</Text>
            </Pressable>
          </View>
        )}

        {phase === "nearby" && (
          <>
            <View style={styles.nearbyContent}>
              {nearbyLoading ? (
                <View style={styles.nearbyLoadingRow}>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                  <Text style={styles.nearbyLoadingText}>
                    Finding nearby places...
                  </Text>
                </View>
              ) : nearbyResults.length === 0 ? (
                <Text style={styles.nearbyEmptyText}>No places found nearby</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nearbyScrollContent}
                >
                  {nearbyResults.map((place) => {
                    const isSelected =
                      selectedNearbyPlaceId === place.placeId;
                    return (
                    <Pressable
                      key={place.placeId}
                      style={[
                        styles.nearbyCard,
                        isSelected && styles.nearbyCardSelected,
                      ]}
                      onPress={() => handleNearbySelectInternal(place)}
                    >
                      <Text style={styles.nearbyName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <View style={styles.nearbySubRow}>
                        {place.primaryType && (
                          <Text style={styles.nearbyType} numberOfLines={1}>
                            {place.primaryType}
                          </Text>
                        )}
                        {place.rating != null && (
                          <Text style={styles.nearbyRating}>
                            {"★"}
                            {place.rating.toFixed(1)}
                          </Text>
                        )}
                        {place.distance != null && (
                          <Text style={styles.nearbyDistance}>
                            {place.distance < 1000
                              ? `${place.distance}m`
                              : `${(place.distance / 1000).toFixed(1)}km`}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.nearbyFooterRow}>
              <Pressable
                style={styles.nearbyBtnRemove}
                onPress={onNearbyDismiss}
              >
                <Text style={styles.nearbyBtnRemoveText}>Remove</Text>
              </Pressable>
              <Pressable style={styles.nearbyBtnKeep} onPress={onNearbyKeepPin}>
                <Text style={styles.nearbyBtnKeepText}>Keep pin</Text>
              </Pressable>
            </View>
          </>
        )}

        {phase === "form" && (
          <>
            {/* Search bar — fixed above scroll */}
            {canSearch && (
              <View style={styles.searchSection}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search a place to fly to..."
                  placeholderTextColor={colors.text.disabled}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchLoading && (
                  <ActivityIndicator
                    size="small"
                    color={GREEN_ACCENT}
                    style={styles.searchSpinner}
                  />
                )}
                {searchResult && !searchLoading && (
                  <View style={styles.searchResultCard}>
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName} numberOfLines={1}>
                        {searchResult.name}
                      </Text>
                      <Text
                        style={styles.searchResultAddress}
                        numberOfLines={1}
                      >
                        {searchResult.address}
                      </Text>
                    </View>
                    <View style={styles.searchResultActions}>
                      <Pressable
                        style={styles.searchActionButton}
                        onPress={handleSearchDropPin}
                      >
                        <Text style={styles.searchActionTextPrimary}>
                          Drop Pin
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.searchActionButtonSecondary}
                        onPress={handleSearchFlyTo}
                      >
                        <Text style={styles.searchActionTextSecondary}>
                          Fly There
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* Anchor stop chips — shown when anchors are provided */}
            {anchorStops && anchorStops.length > 0 && (
              <View style={styles.anchorChipsRow}>
                <Text style={styles.sectionLabel}>Pinned stops</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.anchorChipsScroll}
                >
                  {anchorStops.map((a, idx) => (
                    <Pressable
                      key={a.id}
                      style={styles.anchorChip}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onAnchorEdit?.(a.id);
                      }}
                    >
                      <Text style={styles.anchorChipNumber}>{idx + 1}</Text>
                      <Text style={styles.anchorChipText} numberOfLines={1}>
                        {a.label || `Pin ${idx + 1}`}
                      </Text>
                      {onAnchorRemove && (
                        <Pressable
                          style={styles.anchorChipRemove}
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Medium,
                            );
                            onAnchorRemove(a.id);
                          }}
                          hitSlop={6}
                        >
                          <Text style={styles.anchorChipRemoveText}>✕</Text>
                        </Pressable>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {/* City picker — shown when no city prop and no anchor stops */}
            {!cityProp && !hasAnchors && cityOptions.length > 0 && (
              <View style={styles.cityInputSection}>
                <Text style={styles.sectionLabel}>Where?</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {cityOptions.map((opt) => (
                    <Pressable
                      key={opt.city}
                      style={[
                        styles.pill,
                        selectedCity === opt.city && styles.pillActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCity(opt.city);
                      }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          selectedCity === opt.city && styles.pillTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Ritual shelf */}
            {rituals.length > 0 && (
              <View style={styles.ritualShelf}>
                <Text style={styles.ritualShelfLabel}>RITUALS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.ritualPillRow}
                >
                  {rituals.map((r) => (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.ritualPill,
                        activeRitualId === r.id && styles.ritualPillActive,
                      ]}
                      onPress={() => applyRitual(r)}
                    >
                      <Text style={styles.ritualPillEmoji}>{r.emoji}</Text>
                      <Text
                        style={[
                          styles.ritualPillText,
                          activeRitualId === r.id &&
                            styles.ritualPillTextActive,
                        ]}
                      >
                        {r.name}
                      </Text>
                      {r.usageCount > 0 && (
                        <Text style={styles.ritualUsageCount}>
                          {r.usageCount}×
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Date — expanded by default */}
            <CollapsibleSection title="When?" defaultExpanded colors={colors}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {dateOptions.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.pill,
                      plannedDate === opt.value && styles.pillActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPlannedDate(opt.value);
                      howLongRef.current?.expand();
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        plannedDate === opt.value && styles.pillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </CollapsibleSection>

            {/* Duration */}
            <CollapsibleSection
              ref={howLongRef}
              title="How long?"
              colors={colors}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.pill,
                      !useCustomTime &&
                        durationHours === opt.value &&
                        styles.pillActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setUseCustomTime(false);
                      setDurationHours(opt.value);
                      stopsRef.current?.expand();
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        !useCustomTime &&
                          durationHours === opt.value &&
                          styles.pillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.pill, useCustomTime && styles.pillActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setUseCustomTime((prev) => !prev);
                  }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      useCustomTime && styles.pillTextActive,
                    ]}
                  >
                    {useCustomTime
                      ? `${formatHour(startHour)} – ${formatHour(endHour)}`
                      : "Set times"}
                  </Text>
                </Pressable>
              </ScrollView>

              {/* Inline time pickers */}
              {useCustomTime && (
                <View style={styles.timePickerSection}>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Start</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {TIME_HOURS.filter((h) => h < endHour).map((h) => (
                        <Pressable
                          key={h}
                          style={[
                            styles.timePill,
                            startHour === h && styles.timePillActive,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            setStartHour(h);
                            if (h >= endHour) setEndHour(h + 1);
                          }}
                        >
                          <Text
                            style={[
                              styles.timePillText,
                              startHour === h && styles.timePillTextActive,
                            ]}
                          >
                            {formatHour(h)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>End</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pillRow}
                    >
                      {TIME_HOURS.filter((h) => h > startHour).map((h) => (
                        <Pressable
                          key={h}
                          style={[
                            styles.timePill,
                            endHour === h && styles.timePillActive,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            setEndHour(h);
                            stopsRef.current?.expand();
                          }}
                        >
                          <Text
                            style={[
                              styles.timePillText,
                              endHour === h && styles.timePillTextActive,
                            ]}
                          >
                            {formatHour(h)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <Text style={styles.timeSummary}>
                    {Math.max(1, endHour - startHour)}h window
                  </Text>
                </View>
              )}
            </CollapsibleSection>

            {/* Stops */}
            <CollapsibleSection
              ref={stopsRef}
              title="How many stops?"
              colors={colors}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {STOP_COUNT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.pill,
                      stopCount === opt.value && styles.pillActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setStopCount(opt.value);
                      budgetRef.current?.expand();
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        stopCount === opt.value && styles.pillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </CollapsibleSection>

            {/* Budget */}
            <CollapsibleSection
              ref={budgetRef}
              title={`Budget · ${budgetMax === 0 ? "Free" : `$${budgetMax}`}`}
              colors={colors}
            >
              <BudgetSlider
                value={budgetMax}
                onChange={(v) => {
                  setBudgetMax(v);
                  vibesRef.current?.expand();
                }}
                colors={colors}
              />
            </CollapsibleSection>

            {/* Activities */}
            <CollapsibleSection ref={vibesRef} title="Vibes" colors={colors}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activityScroll}
              >
                {ACTIVITY_OPTIONS.map((opt) => {
                  const isSelected = selectedActivities.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => toggleActivity(opt.value)}
                    >
                      <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.chipLabel,
                          isSelected && styles.chipLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </CollapsibleSection>

            {/* Intention */}
            <CollapsibleSection
              ref={intentionRef}
              title="Intention"
              colors={colors}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {INTENTION_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.chip,
                      selectedIntention === opt.value && styles.chipActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedIntention((prev) =>
                        prev === opt.value ? null : opt.value,
                      );
                    }}
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.chipLabel,
                        selectedIntention === opt.value &&
                          styles.chipLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </CollapsibleSection>

            {error && <Text style={styles.errorText}>{error}</Text>}
            </ScrollView>
          </>
        )}

        {/* Fixed footer buttons */}
        {phase === "form" && (
          <View style={styles.footerRow}>
            <Pressable style={styles.surpriseButton} onPress={handleSurpriseMe}>
              <Text style={styles.surpriseButtonText}>Surprise Me</Text>
            </Pressable>
            <Pressable style={styles.generateButton} onPress={handleGenerate}>
              <Text style={styles.generateButtonText}>Build My Plan</Text>
            </Pressable>
          </View>
        )}

        {phase === "result" && result && (
          <ScrollView
            ref={resultScrollRef}
            showsVerticalScrollIndicator={false}
            bounces
          >
            <Text style={styles.resultTitle}>{result.title}</Text>
            {result.summary && (
              <Text style={styles.resultSummary}>{result.summary}</Text>
            )}
            {result.forecast &&
              (() => {
                const f = result.forecast;
                const items = result.items ?? [];
                let low = f.tempLowF;
                let high = f.tempHighF;
                if (f.hourly?.length && items.length) {
                  const startH = Math.min(
                    ...items.map((i) =>
                      parseInt(i.startTime.split(":")[0], 10),
                    ),
                  );
                  const endH = Math.max(
                    ...items.map((i) =>
                      parseInt(i.endTime.split(":")[0], 10),
                    ),
                  );
                  const rel = f.hourly.filter(
                    (h) => h.hour >= startH && h.hour <= endH,
                  );
                  if (rel.length) {
                    low = Math.round(Math.min(...rel.map((h) => h.tempF)));
                    high = Math.round(Math.max(...rel.map((h) => h.tempF)));
                  }
                }
                return (
                  <View style={styles.forecastRow}>
                    <View style={styles.forecastChip}>
                      <Text style={styles.forecastText}>
                        {conditionEmoji(f.dominantCondition)}{" "}
                        {low === high ? `${high}°F` : `${low}–${high}°F`}
                      </Text>
                    </View>
                    <View style={styles.forecastChip}>
                      <Text style={styles.forecastText}>
                        {f.dominantCondition}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            <ItineraryTimeline
              items={result.items}
              forecast={result.forecast}
              scrollRef={resultScrollRef}
            />
            <View style={styles.resultFooterRow}>
              <Pressable style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Build another</Text>
              </Pressable>
              <Pressable
                style={styles.viewButton}
                onPress={() =>
                  router.push(`/itineraries/${result.id}` as const)
                }
              >
                <Text style={styles.viewButtonText}>View Itinerary</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bubble: {
      backgroundColor: colors.bg.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      overflow: "hidden",
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: -spacing.lg,
    },
    statusOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    statusText: {
      color: colors.text.secondary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    sheenBeam: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
      zIndex: 5,
    },
    headerTitle: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    dismissButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bg.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissText: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    pillRow: {
      flexDirection: "row",
      gap: 6,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    pillActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    pillText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    pillTextActive: {
      color: GREEN_ACCENT,
    },
    segmentRow: {
      flexDirection: "row",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: GREEN_MUTED,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    segmentText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    segmentTextActive: {
      color: GREEN_ACCENT,
    },
    activityScroll: {
      gap: 6,
      paddingRight: spacing.md,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: 4,
    },
    chipActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    chipEmoji: {
      fontSize: 13,
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    chipLabelActive: {
      color: GREEN_ACCENT,
    },
    errorText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.status.error.text,
      marginTop: spacing.sm,
    },
    footerRow: {
      flexDirection: "row",
      gap: 8,
      paddingTop: spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
      zIndex: 5,
    },
    generateButton: {
      flex: 1,
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: 10,
      alignItems: "center",
    },
    generateButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    surpriseButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: "center",
    },
    surpriseButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    resultTitle: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      color: colors.text.primary,
      fontWeight: "700",
    },
    forecastRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: spacing.sm,
    },
    forecastChip: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: "rgba(253, 186, 116, 0.25)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    forecastText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: "700",
      color: "#f9a8d4",
    },
    resultSummary: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 4,
      marginBottom: spacing.sm,
      lineHeight: 19,
    },
    resultFooterRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    resetButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.accent,
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: "center",
    },
    resetButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    viewButton: {
      flex: 1,
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: 10,
      alignItems: "center",
    },
    viewButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    /* ── Ritual shelf ─── */
    ritualShelf: {
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    ritualShelfLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    ritualPillRow: {
      flexDirection: "row",
      gap: 6,
    },
    ritualPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: 4,
    },
    ritualPillActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    ritualPillEmoji: {
      fontSize: 13,
    },
    ritualPillText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    ritualPillTextActive: {
      color: GREEN_ACCENT,
    },
    ritualUsageCount: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
    },
    /* ── Time picker ─── */
    timePickerSection: {
      marginTop: spacing.sm,
      gap: 8,
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    timeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
      textTransform: "uppercase",
      letterSpacing: 1,
      width: 36,
    },
    timePill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    timePillActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    timePillText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
    timePillTextActive: {
      color: GREEN_ACCENT,
    },
    timeSummary: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
      textAlign: "right",
      letterSpacing: 0.5,
    },
    /* ── City input ─── */
    cityInputSection: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    anchorChipsRow: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    anchorChipsScroll: {
      gap: 8,
      marginTop: 6,
      paddingRight: spacing.md,
    },
    anchorChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bg.elevated,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    anchorChipNumber: {
      color: "#0a2618",
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: "800",
      backgroundColor: GREEN_ACCENT,
      width: 18,
      height: 18,
      borderRadius: 9,
      textAlign: "center",
      lineHeight: 18,
      overflow: "hidden",
    },
    anchorChipText: {
      color: colors.text.primary,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      maxWidth: 120,
    },
    anchorChipRemove: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.bg.card,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 2,
    },
    anchorChipRemoveText: {
      fontSize: 9,
      color: colors.text.disabled,
      fontWeight: "700",
    },
    /* ── Nearby places ─── */
    nearbyContent: {
      flex: 1,
      justifyContent: "center",
    },
    nearbyLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    nearbyLoadingText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    nearbyEmptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      textAlign: "center",
      paddingVertical: spacing.md,
    },
    nearbyScrollContent: {
      paddingHorizontal: 0,
      gap: 6,
      alignItems: "flex-start",
    },
    nearbyCard: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingHorizontal: 12,
      paddingVertical: 6,
      maxWidth: 200,
      overflow: "hidden",
    },
    nearbyCardSelected: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    nearbyName: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.text.primary,
    },
    nearbySubRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    nearbyType: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      flexShrink: 1,
    },
    nearbyRating: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.accent.primary,
    },
    nearbyDistance: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
    },
    nearbyFooterRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      marginTop: spacing.sm,
    },
    nearbyBtnRemove: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      alignItems: "center",
    },
    nearbyBtnRemoveText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: "600",
      color: colors.text.secondary,
    },
    nearbyBtnKeep: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.accent.primary,
      alignItems: "center",
    },
    nearbyBtnKeepText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: "600",
      color: colors.fixed.black,
    },
    /* ── Place search ─── */
    searchSection: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    searchInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchSpinner: {
      marginTop: 8,
      alignSelf: "center",
    },
    searchResultCard: {
      marginTop: 8,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: 10,
      gap: 8,
    },
    searchResultInfo: {
      gap: 2,
    },
    searchResultName: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontWeight: "700",
      color: colors.text.primary,
    },
    searchResultAddress: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
    searchResultActions: {
      flexDirection: "row",
      gap: 8,
    },
    searchActionButton: {
      flex: 1,
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: 6,
      alignItems: "center",
    },
    searchActionTextPrimary: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    searchActionButtonSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.sm,
      paddingVertical: 6,
      alignItems: "center",
    },
    searchActionTextSecondary: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });
