import { formatDate } from "@/utils/dateTimeFormatting";
import { BookmarkIcon, Calendar, CheckCircle, Eye, Info, Map, MapPin, Navigation, User } from "lucide-react-native";
import React, { useMemo, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Pressable } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing
} from "react-native-reanimated";
import EventQRCodeSection from "./EventQRCodeSection";
import SaveButton from "./SaveButton";


// Unified color theme
const COLORS = {
  // Primary colors
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",

  // UI elements
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",

  // Status colors
  success: "#40c057",
  successBackground: "rgba(64, 192, 87, 0.12)",
  successBorder: "rgba(64, 192, 87, 0.2)",

  // Vibrant Icon Colors
  iconUser: "#ff922b",
  iconEngagement: "#a5d8ff",
  iconVerified: "#69db7c",
  iconDateTime: "#ffd43b",
  iconLocation: "#ff8787",
  iconCategories: "#da77f2",
  iconDefault: "#93c5fd",
};

// Helper to generate icon background color from primary color
const getIconBackgroundColor = (color: string) => {
  // Basic hex to rgba conversion assuming hex is #RRGGBB
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  }
  return 'rgba(147, 197, 253, 0.15)'; // Fallback
};

const styles = StyleSheet.create({
  // Main container with enhanced styling
  eventHeaderContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    marginVertical: 20,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },

  // Content container with proper padding
  headerContent: {
    padding: 20,
  },

  // Top row with emoji and title
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    position: 'relative',
  },

  // Emoji container styling
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 16,
  },

  resultEmoji: {
    fontSize: 24,
  },

  // Title area styling
  eventTitleWrapper: {
    flex: 1,
    paddingRight: 40,
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: -0.2,
    lineHeight: 28,
  },

  // Description styling
  descriptionContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  descriptionText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'SpaceMono',
    lineHeight: 22,
  },

  // Divider styling
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 20,
  },

  // Info sections container
  infoSections: {
    gap: 20,
  },

  // Info section styling
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 4,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'SpaceMono',
    lineHeight: 22,
    marginBottom: 6,
  },

  infoValueSecondary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
    marginBottom: 6,
  },

  infoValueSmall: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    lineHeight: 18,
    marginBottom: 4,
  },

  // Stats container
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  statIcon: {
    marginRight: 6,
  },

  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    fontWeight: '500',
  },

  // Verified badge with improved styling
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    marginTop: 8,
  },

  statusText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  // Save button styling
  saveButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  // Location actions container
  locationActions: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
  },

  // Map and Directions buttons
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  actionButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    fontFamily: "SpaceMono",
  },

  // Category tags
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },

  categoryTag: {
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  categoryText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: 'SpaceMono',
  },

  // QR Code section
  qrSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
});

// Memoized Header Component
const EventHeader = React.memo(({ event, titleFontSize, isSaved, savingState, handleToggleSave }: any) => {
  // Shared values for animation
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Start animation on mount
  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(5, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1, // Infinite repeat
      true // Reverse animation smoothly
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [translateY, scale]);

  // Animated style for the emoji container
  const animatedEmojiContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(600).springify()}
      layout={LinearTransition.duration(300)}
      style={styles.topRow}
    >
      {/* Wrap emoji container with Animated.View and apply style */}
      <Animated.View style={animatedEmojiContainerStyle}>
        <View style={styles.emojiContainer}>
          <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
        </View>
      </Animated.View>

      <View style={styles.eventTitleWrapper}>
        <Text
          style={[styles.resultTitle, { fontSize: titleFontSize }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {event.title}
        </Text>
      </View>

      <SaveButton
        isSaved={isSaved}
        savingState={savingState}
        onSave={handleToggleSave}
      />
    </Animated.View>
  );
});

// Memoized Description Component
const EventDescription = React.memo(({ description }: { description: string }) => (
  <Animated.View
    entering={FadeInDown.duration(600).delay(200).springify()}
    layout={Layout.duration(300)}
    style={styles.descriptionContainer}
  >
    <Text style={styles.descriptionText}>
      {description}
    </Text>
  </Animated.View>
));

// Memoized Info Section Component
const EventInfoSection = React.memo(({
  icon: Icon,
  label,
  children,
  delay = 0,
  iconColor = COLORS.iconDefault,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
  delay?: number;
  iconColor?: string;
}) => {
  // Shared value for background pulse animation
  const backgroundOpacity = useSharedValue(0.15); // Initial opacity from getIconBackgroundColor

  // Start pulse animation on mount
  useEffect(() => {
    backgroundOpacity.value = withRepeat(
      withSequence(
        // Fade slightly more opaque
        withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        // Fade back to base opacity
        withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1, // Infinite repeat
      true // Reverse smoothly
    );
  }, [backgroundOpacity]);

  // Animated style for the icon background pulse
  const animatedIconBackgroundStyle = useAnimatedStyle(() => {
    // Recalculate RGBA based on pulsing opacity
    if (iconColor.startsWith('#') && iconColor.length === 7) {
      const r = parseInt(iconColor.slice(1, 3), 16);
      const g = parseInt(iconColor.slice(3, 5), 16);
      const b = parseInt(iconColor.slice(5, 7), 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${backgroundOpacity.value})`,
      };
    }
    // Fallback for default color if needed (though should always get a hex)
    return {
      backgroundColor: `rgba(147, 197, 253, ${backgroundOpacity.value})`,
    };
  });

  return (
    <Animated.View
      entering={FadeInUp.duration(600).delay(delay).springify()}
      layout={Layout.duration(300)}
      style={styles.infoSection}
    >
      {/* Apply dynamic animated background color */}
      <Animated.View style={[styles.infoIcon, animatedIconBackgroundStyle]}>
        <Icon size={18} color={iconColor} />
      </Animated.View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {children}
      </View>
    </Animated.View>
  );
});

// Memoized Stats Component
const EventStats = React.memo(({ event }: { event: any }) => (
  <View style={styles.statsContainer}>
    <View style={styles.statItem}>
      <BookmarkIcon size={16} color={COLORS.accent} style={styles.statIcon} />
      <Text style={styles.statText}>
        {event.saveCount || 0}
      </Text>
    </View>
    <View style={styles.statItem}>
      <Eye size={16} color={COLORS.accent} style={styles.statIcon} />
      <Text style={styles.statText}>
        {event.scanCount || 0}
      </Text>
    </View>
  </View>
));

// Memoized Location Actions Component
const LocationActions = React.memo(({
  handleOpenMaps,
  handleGetDirections,
  userLocation,
  event
}: any) => {
  // Shared values for animations
  const mapScale = useSharedValue(1);
  const directionsScale = useSharedValue(1);

  // Animated styles
  const mapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mapScale.value }],
  }));
  const directionsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: directionsScale.value }],
  }));

  // Press handlers
  const handleMapPressIn = () => { mapScale.value = withSpring(0.95); };
  const handleMapPressOut = () => { mapScale.value = withSpring(1); };
  const handleDirectionsPressIn = () => { directionsScale.value = withSpring(0.95); };
  const handleDirectionsPressOut = () => { directionsScale.value = withSpring(1); };

  return (
    <View style={styles.locationActions}>
      {/* Map Button */}
      <Pressable
        onPress={handleOpenMaps}
        onPressIn={handleMapPressIn}
        onPressOut={handleMapPressOut}
      >
        <Animated.View style={[styles.actionButton, mapAnimatedStyle]}>
          <Map size={14} color={COLORS.accent} />
          <Text style={styles.actionButtonText}>View Map</Text>
        </Animated.View>
      </Pressable>

      {/* Directions Button (Conditional) */}
      {userLocation && event.coordinates && (
        <Pressable
          onPress={handleGetDirections}
          onPressIn={handleDirectionsPressIn}
          onPressOut={handleDirectionsPressOut}
        >
          <Animated.View style={[styles.actionButton, directionsAnimatedStyle]}>
            <Navigation size={14} color={COLORS.accent} />
            <Text style={styles.actionButtonText}>Directions</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
});

// Memoized Categories Component
const EventCategories = React.memo(({ categories }: { categories: any[] }) => (
  <View style={styles.categoriesContainer}>
    {categories.map((category: any, index: number) => (
      <View key={index} style={styles.categoryTag}>
        <Text style={styles.categoryText}>
          {typeof category === "string" ? category : category.name}
        </Text>
      </View>
    ))}
  </View>
));

const EventDetailsHeader = ({
  event,
  savingState,
  handleToggleSave,
  isSaved,
  handleOpenMaps,
  handleGetDirections,
  userLocation,
}: {
  event: any;
  isSaved: boolean;
  savingState: "idle" | "loading";
  handleToggleSave: () => void;
  handleOpenMaps: () => void;
  handleGetDirections: () => void;
  userLocation: any;
}) => {
  const titleFontSize = useMemo(() => {
    return event.title.length > 40 ? 20 : 24;
  }, [event.title]);

  const formatTimeRange = (startDate: Date | string, endDate?: Date | string, timezone?: string) => {
    const formatTime = (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    if (!endDate) {
      return formatTime(startDate);
    }

    return `${formatTime(startDate)} - ${formatTime(endDate)}`;
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(800).springify()}
      layout={Layout.duration(300)}
      style={styles.eventHeaderContainer}
    >
      <View style={styles.headerContent}>
        <EventHeader
          event={event}
          titleFontSize={titleFontSize}
          isSaved={isSaved}
          savingState={savingState}
          handleToggleSave={handleToggleSave}
        />

        {event.description && (
          <EventDescription description={event.description} />
        )}

        <Animated.View
          entering={FadeInUp.duration(600).delay(400).springify()}
          layout={Layout.duration(300)}
          style={styles.divider}
        />

        <View style={styles.infoSections}>
          {event.creator && (
            <EventInfoSection
              icon={User}
              label="Scanned By"
              delay={300}
              iconColor={COLORS.iconUser}
            >
              <Text style={styles.infoValue}>
                {event.creator.displayName || event.creator.email}
              </Text>
            </EventInfoSection>
          )}

          <EventInfoSection
            icon={BookmarkIcon}
            label="Engagement"
            delay={350}
            iconColor={COLORS.iconEngagement}
          >
            <EventStats event={event} />
          </EventInfoSection>

          {event.verified && (
            <EventInfoSection
              icon={CheckCircle}
              label="Verification"
              delay={400}
              iconColor={COLORS.iconVerified}
            >
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>VERIFIED EVENT</Text>
              </View>
            </EventInfoSection>
          )}

          <EventInfoSection
            icon={Calendar}
            label="Date & Time"
            delay={450}
            iconColor={COLORS.iconDateTime}
          >
            <Text style={styles.infoValue}>
              {formatDate(event.eventDate, event.timezone)}
            </Text>
            <Text style={styles.infoValueSecondary}>
              {formatTimeRange(event.eventDate, event.endDate)}
              {event.timezone && ` (${event.timezone})`}
            </Text>
          </EventInfoSection>

          <EventInfoSection
            icon={MapPin}
            label="Location"
            delay={500}
            iconColor={COLORS.iconLocation}
          >
            <Text style={styles.infoValue}>{event.location}</Text>
            {event.locationNotes && event.locationNotes !== "No additional location context provided" && (
              <Text style={styles.infoValueSmall}>
                {event.locationNotes}
              </Text>
            )}
            <LocationActions
              handleOpenMaps={handleOpenMaps}
              handleGetDirections={handleGetDirections}
              userLocation={userLocation}
              event={event}
            />
          </EventInfoSection>

          {event.categories && event.categories.length > 0 && (
            <EventInfoSection
              icon={Info}
              label="Categories"
              delay={550}
              iconColor={COLORS.iconCategories}
            >
              <EventCategories categories={event.categories} />
            </EventInfoSection>
          )}
        </View>

        {(event.qrCodeData || event.detectedQrData) && (
          <Animated.View
            entering={FadeInUp.duration(600).delay(900).springify()}
            layout={Layout.duration(300)}
            style={styles.qrSection}
          >
            <EventQRCodeSection event={event} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

export default React.memo(EventDetailsHeader);