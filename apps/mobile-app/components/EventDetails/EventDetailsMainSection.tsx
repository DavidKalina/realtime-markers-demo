import { EventType } from "@/types/types";
import { formatDate, getUserLocalTime } from "@/utils/dateTimeFormatting";
import { Calendar, Info, Map, MapPin, Navigation, User } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View, Animated, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // Main container
  detailsContainer: {
    gap: 16,
    marginBottom: 20,
  },

  // Card styling for each section
  card: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    padding: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },

  // Card header with icon and gradient
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 50,
  },

  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    backgroundColor: "rgba(147, 197, 253, 0.2)",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  // Card content
  cardContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 6,
  },

  // Specific content styles
  detailValue: {
    fontSize: 15,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginTop: 2,
  },

  // Time zone info styling
  timezoneText: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    borderRadius: 8,
    marginTop: 10,
    alignSelf: "flex-start",
  },

  timezoneTextContent: {
    color: "#93c5fd",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },

  // Location section styling
  locationSection: {
    marginBottom: 16,
  },

  locationLabel: {
    fontSize: 13,
    color: '#93c5fd',
    fontFamily: 'SpaceMono',
    fontWeight: '500',
    marginBottom: 4,
  },

  // Location notes styling
  locationNotesContainer: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },

  locationNotesText: {
    fontSize: 13,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    lineHeight: 18,
  },

  // Distance info styling
  distanceInfoContainer: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  distanceInfoText: {
    fontSize: 13,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },

  // Location actions container
  locationActionContainer: {
    flexDirection: "row",
    marginTop: 8,
    gap: 12,
  },

  // Map and Directions buttons
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },

  actionButtonText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    fontFamily: "SpaceMono",
  },

  // Categories styling
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },

  categoryBadge: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },

  categoryText: {
    fontSize: 12,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },

  // Date & Time styling
  dateTimeContainer: {
    gap: 16,
  },

  dateTimeSection: {
    gap: 4,
  },

  dateTimeLabel: {
    fontSize: 13,
    color: '#93c5fd',
    fontFamily: 'SpaceMono',
    fontWeight: '500',
  },

  dateTimeValueContainer: {
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  dateTimeValue: {
    fontSize: 15,
    color: '#f8f9fa',
    fontFamily: 'SpaceMono',
    lineHeight: 20,
  },

  localTimeContainer: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  localTimeText: {
    fontSize: 13,
    color: '#93c5fd',
    fontFamily: 'SpaceMono',
    lineHeight: 18,
  },
});

interface EventDetailsMainSectionProps {
  event: EventType;
  distanceInfo: string | null;
  isLoadingLocation: boolean;
  isAdmin: boolean;
  userLocation: [number, number] | null;
  handleOpenMaps: () => void;
  handleGetDirections: () => void;
}

const EventDetailsMainSection: React.FC<EventDetailsMainSectionProps> = ({
  event,
  distanceInfo,
  isLoadingLocation,
  userLocation,
  handleGetDirections,
  handleOpenMaps,
}) => {
  // Card component for consistent styling
  const DetailCard = ({
    icon,
    title,
    color = "#93c5fd",
    children,
  }: {
    icon: React.ReactNode;
    title: string;
    color?: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconContainer, { backgroundColor: `${color}20` }]}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );

  return (
    <View style={styles.detailsContainer}>
      {/* Date & Time Card */}
      <DetailCard icon={<Calendar size={20} color="#93c5fd" />} title="Date & Time">
        <View style={styles.dateTimeContainer}>
          {/* Date Section */}
          <View style={styles.dateTimeSection}>
            <Text style={styles.dateTimeLabel}>Date</Text>
            <View style={styles.dateTimeValueContainer}>
              <Text style={styles.dateTimeValue}>
                {formatDate(event.eventDate, event.timezone)}
                {event.endDate && (
                  <>
                    {" - "}
                    {formatDate(event.endDate, event.timezone)}
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* Time Section */}
          <View style={styles.dateTimeSection}>
            <Text style={styles.dateTimeLabel}>Time</Text>
            <View style={styles.dateTimeValueContainer}>
              <Text style={styles.dateTimeValue}>
                {new Date(event.eventDate).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
                {event.endDate && (
                  <>
                    {" - "}
                    {new Date(event.endDate).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </>
                )}
              </Text>
            </View>
          </View>

          {/* Local Time Section - Only show if different */}
          {getUserLocalTime(event.eventDate, event.timezone) && (
            <View style={styles.dateTimeSection}>
              <Text style={styles.dateTimeLabel}>Your Local Time</Text>
              <View style={styles.localTimeContainer}>
                <Text style={styles.localTimeText}>
                  {getUserLocalTime(event.eventDate, event.timezone)}
                  {event.endDate && (
                    <>
                      {" - "}
                      {getUserLocalTime(event.endDate, event.timezone)}
                    </>
                  )}
                </Text>
              </View>
            </View>
          )}
        </View>
      </DetailCard>

      {/* Location Card */}
      <DetailCard icon={<MapPin size={20} color="#93c5fd" />} title="Location">
        {/* Main Address */}
        <View style={styles.locationSection}>
          <Text style={styles.locationLabel}>Address</Text>
          <Text style={styles.detailValue}>{event.location}</Text>
        </View>

        {/* Location Notes - Only show if there are notes */}
        {event.locationNotes && event.locationNotes !== "No additional location context provided" && (
          <View style={styles.locationSection}>
            <Text style={styles.locationLabel}>Additional Details</Text>
            <View style={styles.locationNotesContainer}>
              <Text style={styles.locationNotesText}>{event.locationNotes}</Text>
            </View>
          </View>
        )}

        {/* Distance Info */}
        {distanceInfo && (
          <View style={styles.locationSection}>
            <Text style={styles.locationLabel}>Distance</Text>
            <View style={styles.distanceInfoContainer}>
              <Text style={styles.distanceInfoText}>
                {isLoadingLocation ? "Calculating distance..." : distanceInfo}
              </Text>
            </View>
          </View>
        )}

        {/* Location Action Buttons */}
        <View style={styles.locationActionContainer}>
          {/* Map Button */}
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenMaps}>
            <Map size={18} color="#93c5fd" />
            <Text style={styles.actionButtonText}>View on Map</Text>
          </TouchableOpacity>

          {/* Directions Button - Only show if we have user location */}
          {userLocation && event.coordinates && (
            <TouchableOpacity style={styles.actionButton} onPress={handleGetDirections}>
              <Navigation size={18} color="#93c5fd" />
              <Text style={styles.actionButtonText}>Directions</Text>
            </TouchableOpacity>
          )}
        </View>
      </DetailCard>

      {/* Scanned By Card */}
      {event.creator && (
        <DetailCard icon={<User size={20} color="#93c5fd" />} title="Scanned By">
          <Text style={styles.detailValue}>{event.creator.displayName || event.creator.email}</Text>
        </DetailCard>
      )}

      {/* Description Card */}
      <DetailCard icon={<Info size={20} color="#93c5fd" />} title="Description">
        <Text style={styles.detailValue}>{event.description}</Text>
      </DetailCard>

      {/* Categories Card */}
      {event.categories && event.categories.length > 0 && (
        <DetailCard icon={<Info size={20} color="#93c5fd" />} title="Categories">
          <View style={styles.categoriesContainer}>
            {event.categories.map((category: any, index: number) => (
              <View key={index} style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {typeof category === "string" ? category : category.name}
                </Text>
              </View>
            ))}
          </View>
        </DetailCard>
      )}
    </View>
  );
};

export default EventDetailsMainSection;
