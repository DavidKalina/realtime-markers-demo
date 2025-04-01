import { formatDate } from "@/utils/dateTimeFormatting";
import { BookmarkIcon, Calendar, CheckCircle, Eye, Info, Map, MapPin, Navigation, User } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  LinearTransition
} from "react-native-reanimated";
import EventQRCodeSection from "./EventQRCodeSection";
import SaveButton from "./SaveButton";


// Unified color theme
const COLORS = {
  // Primary colors
  background: "#2a2a2a",
  cardBackground: "#3a3a3a",
  textPrimary: "#f8f9fa",
  textSecondary: "#93c5fd", // Using the blue from QR component
  accent: "#93c5fd", // Using the blue from QR component

  // UI elements
  divider: "rgba(147, 197, 253, 0.12)",
  buttonBackground: "rgba(147, 197, 253, 0.1)",
  buttonBorder: "rgba(147, 197, 253, 0.15)",
  iconBackground: "rgba(147, 197, 253, 0.15)",

  // Status colors
  success: "#40c057",
  successBackground: "rgba(64, 192, 87, 0.12)",
  successBorder: "rgba(64, 192, 87, 0.2)",
};

const styles = StyleSheet.create({
  // Main container with enhanced styling
  eventHeaderContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    overflow: "hidden",
  },

  // Content container with proper padding
  headerContent: {
    padding: 24,
  },

  // Top row with emoji and title
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    position: 'relative',
  },

  // Emoji container styling
  emojiContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.iconBackground,
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
  },

  // Description styling
  descriptionContainer: {
    marginBottom: 20,
  },

  descriptionText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: 'SpaceMono',
    lineHeight: 22,
  },

  // Divider styling
  divider: {
    height: 2,
    backgroundColor: COLORS.divider,
    marginVertical: 24,
  },

  // Info sections container
  infoSections: {
    gap: 24,
  },

  // Info section styling
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.iconBackground,
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

  // Meta info container
  metaContainer: {
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  metaSectionHeader: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  metaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },

  // QR Code section
  qrSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  // We'll remove these since we're using the actual component
  qrContainer: {
    backgroundColor: COLORS.textPrimary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  qrLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    fontWeight: '600',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Creator info
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  creatorText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    fontWeight: '500',
    marginLeft: 8,
  },

  // Stats container
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  // Location actions container
  locationActions: {
    flexDirection: "row",
    marginTop: 16,
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
    marginTop: 6,
  },

  categoryTag: {
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  categoryText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: 'SpaceMono',
  },
});

// Memoized Header Component
const EventHeader = React.memo(({ event, titleFontSize, isSaved, savingState, handleToggleSave }: any) => (
  <Animated.View
    entering={FadeInDown.duration(600).springify()}
    layout={LinearTransition.duration(300)}
    style={styles.topRow}
  >
    <View style={styles.emojiContainer}>
      <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
    </View>

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
));

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
  delay = 0
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
  delay?: number;
}) => (
  <Animated.View
    entering={FadeInUp.duration(600).delay(delay).springify()}
    layout={Layout.duration(300)}
    style={styles.infoSection}
  >
    <View style={styles.infoIcon}>
      <Icon size={18} color={COLORS.accent} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children}
    </View>
  </Animated.View>
));

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
}: any) => (
  <View style={styles.locationActions}>
    <TouchableOpacity style={styles.actionButton} onPress={handleOpenMaps}>
      <Map size={14} color={COLORS.accent} />
      <Text style={styles.actionButtonText}>View Map</Text>
    </TouchableOpacity>
    {userLocation && event.coordinates && (
      <TouchableOpacity style={styles.actionButton} onPress={handleGetDirections}>
        <Navigation size={14} color={COLORS.accent} />
        <Text style={styles.actionButtonText}>Directions</Text>
      </TouchableOpacity>
    )}
  </View>
));

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
            >
              <Text style={styles.infoValue}>
                {event.creator.displayName || event.creator.email}
              </Text>
            </EventInfoSection>
          )}

          <EventInfoSection
            icon={BookmarkIcon}
            label="Engagement"
            delay={400}
          >
            <EventStats event={event} />
          </EventInfoSection>

          {event.verified && (
            <EventInfoSection
              icon={CheckCircle}
              label="Verification"
              delay={500}
            >
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>VERIFIED EVENT</Text>
              </View>
            </EventInfoSection>
          )}

          <EventInfoSection
            icon={Calendar}
            label="Date & Time"
            delay={600}
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
            delay={700}
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
              delay={800}
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