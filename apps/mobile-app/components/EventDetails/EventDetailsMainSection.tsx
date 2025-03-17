import { formatDate, getUserLocalTime } from "@/utils/dateTimeFormatting";
import { Calendar, Info, Map, MapPin, Navigation, User } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import AdminOriginalImageViewer from "../AdminOriginalImageViewer/AdminOriginalImageViewer";
import EventQRCodeSection from "./EventQRCodeSection";
import { styles } from "./styles";

interface EventDetailsMainSectionProps {
  event: any;
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
  isAdmin,
  userLocation,
  handleGetDirections,
  handleOpenMaps,
}) => {
  return (
    <View style={styles.detailsContainer}>
      <View style={styles.detailSection}>
        <View style={styles.resultDetailsRow}>
          <Calendar size={16} color="#93c5fd" style={{ marginRight: 8 }} />
          <Text style={styles.detailLabel}>Date & Time</Text>
        </View>
        <Text style={styles.detailValue}>
          {formatDate(event.eventDate, event.timezone)}
          {event.endDate && (
            <>
              {" - "}
              {formatDate(event.endDate, event.timezone)}
            </>
          )}
        </Text>

        {/* Add user's local time if different */}
        {getUserLocalTime(event.eventDate, event.timezone) && (
          <Text style={styles.timezoneText}>
            {getUserLocalTime(event.eventDate, event.timezone)}
            {event.endDate && (
              <>
                {" - "}
                {getUserLocalTime(event.endDate, event.timezone)}
              </>
            )}
          </Text>
        )}
      </View>

      <View style={styles.detailSection}>
        <View style={styles.resultDetailsRow}>
          <MapPin size={16} color="#93c5fd" style={{ marginRight: 8 }} />
          <Text style={styles.detailLabel}>Location</Text>
        </View>
        <View style={styles.locationContainer}>
          <Text style={styles.detailValue}>{event.location}</Text>

          {/* Show calculated distance */}
          {distanceInfo && (
            <View style={styles.distanceInfoContainer}>
              <Text style={styles.distanceInfoText}>
                {isLoadingLocation ? "Calculating distance..." : distanceInfo}
              </Text>
            </View>
          )}

          {/* Location Action Buttons */}
          <View style={styles.locationActionContainer}>
            {/* Map Button */}
            <TouchableOpacity style={styles.mapButton} onPress={handleOpenMaps}>
              <Map size={16} color="#f8f9fa" />
              <Text style={styles.mapButtonText}>View on Map</Text>
            </TouchableOpacity>

            {/* Directions Button - Only show if we have user location */}
            {userLocation && event.coordinates && (
              <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
                <Navigation size={16} color="#f8f9fa" />
                <Text style={styles.directionsButtonText}>Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* New Scanned By Section */}
      {event.creator && (
        <View style={styles.detailSection}>
          <View style={styles.resultDetailsRow}>
            <User size={16} color="#93c5fd" style={{ marginRight: 8 }} />
            <Text style={styles.detailLabel}>Scanned By</Text>
          </View>
          <Text style={styles.detailValue}>{event.creator.displayName || event.creator.email}</Text>
        </View>
      )}

      <View style={styles.detailSection}>
        <View style={styles.resultDetailsRow}>
          <Info size={16} color="#93c5fd" style={{ marginRight: 8 }} />
          <Text style={styles.detailLabel}>Description</Text>
        </View>
        <Text style={styles.detailValue}>{event.description}</Text>
      </View>

      {event.categories && event.categories.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Categories</Text>
          <View style={styles.categoriesContainer}>
            {event.categories.map((category: any, index: number) => (
              <View key={index} style={styles.categoryBadge}>
                <Text style={styles.categoryText}>
                  {typeof category === "string" ? category : category.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {(event.qrCodeData || event.detectedQrData) && <EventQRCodeSection event={event} />}
      {isAdmin && <AdminOriginalImageViewer eventId={event.id} isAdmin={isAdmin} />}
    </View>
  );
};

export default EventDetailsMainSection;
