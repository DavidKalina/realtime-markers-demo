import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated } from "react-native";
import { Bookmark, BookmarkCheck, CheckCircle, User, BookmarkIcon, Eye, Calendar, MapPin, Info, Map, Navigation } from "lucide-react-native";
import { formatDate, getUserLocalTime } from "@/utils/dateTimeFormatting";
import EventQRCodeSection from "./EventQRCodeSection";

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
    alignItems: "flex-start",
    marginBottom: 20,
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
    paddingRight: 50, // Make space for save button
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // Description styling
  descriptionContainer: {
    marginBottom: 20,
  },

  descriptionText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    lineHeight: 22,
  },

  // Divider styling
  divider: {
    height: 1,
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
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const titleFontSize = useMemo(() => {
    return event.title.length > 40 ? 20 : 24;
  }, [event.title]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

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
    <View style={styles.eventHeaderContainer}>
      <View style={styles.headerContent}>
        {/* Top Row with Emoji and Title */}
        <View style={styles.topRow}>
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

            {/* Description */}
            {event.description && (
              <View style={styles.descriptionContainer}>
                <Text
                  style={styles.descriptionText}
                >
                  {event.description}
                </Text>
              </View>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.saveButton, savingState === "loading" && { opacity: 0.7 }]}
              onPress={handleToggleSave}
              disabled={savingState === "loading"}
              activeOpacity={0.7}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              {savingState === "loading" ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : isSaved ? (
                <BookmarkCheck size={24} color={COLORS.accent} />
              ) : (
                <Bookmark size={24} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Divider after title/description */}
        <View style={styles.divider} />

        {/* Info Sections */}
        <View style={styles.infoSections}>
          {/* Creator Section */}
          {event.creator && (
            <View style={styles.infoSection}>
              <View style={styles.infoIcon}>
                <User size={18} color={COLORS.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Scanned By</Text>
                <Text style={styles.infoValue}>
                  {event.creator.displayName || event.creator.email}
                </Text>
              </View>
            </View>
          )}

          {/* Stats Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoIcon}>
              <BookmarkIcon size={18} color={COLORS.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Engagement</Text>
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
            </View>
          </View>

          {/* Verification Section */}
          {event.verified && (
            <View style={styles.infoSection}>
              <View style={styles.infoIcon}>
                <CheckCircle size={18} color={COLORS.success} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Verification</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>VERIFIED EVENT</Text>
                </View>
              </View>
            </View>
          )}

          {/* Date & Time */}
          <View style={styles.infoSection}>
            <View style={styles.infoIcon}>
              <Calendar size={18} color={COLORS.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoValue}>
                {formatDate(event.eventDate, event.timezone)}
              </Text>
              <Text style={styles.infoValueSecondary}>
                {formatTimeRange(event.eventDate, event.endDate)}
                {event.timezone && ` (${event.timezone})`}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.infoSection}>
            <View style={styles.infoIcon}>
              <MapPin size={18} color={COLORS.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{event.location}</Text>
              {event.locationNotes && event.locationNotes !== "No additional location context provided" && (
                <Text style={styles.infoValueSmall}>
                  {event.locationNotes}
                </Text>
              )}
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
            </View>
          </View>

          {/* Categories */}
          {event.categories && event.categories.length > 0 && (
            <View style={styles.infoSection}>
              <View style={styles.infoIcon}>
                <Info size={18} color={COLORS.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Categories</Text>
                <View style={styles.categoriesContainer}>
                  {event.categories.map((category: any, index: number) => (
                    <View key={index} style={styles.categoryTag}>
                      <Text style={styles.categoryText}>
                        {typeof category === "string" ? category : category.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Divider before QR code */}
        <View style={styles.divider} />

        {/* QR Code Section */}
        {(event.qrCodeData || event.detectedQrData) && (
          <View style={styles.qrSection}>
            <EventQRCodeSection event={event} />
          </View>
        )}
      </View>
    </View>
  );
};

export default React.memo(EventDetailsHeader);