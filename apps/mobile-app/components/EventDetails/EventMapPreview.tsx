import React from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { EmojiMapMarker } from "../Markers/CustomMapMarker";
import { styles } from "./styles";
import { COLORS } from "../Layout/ScreenLayout";

interface EventMapPreviewProps {
  coordinates: [number, number];
  eventId: string;
  title: string;
  emoji: string;
  isPrivate?: boolean;
  eventDate: string;
  imageUrl?: string | null;
  imageLoading?: boolean;
  imageError?: string | null;
  onImagePress?: () => void;
  mapStyle: string;
  mapRef?: React.RefObject<MapboxGL.MapView>;
  cameraRef?: React.RefObject<MapboxGL.Camera>;
  onMapReady?: () => void;
}

const EventMapPreview: React.FC<EventMapPreviewProps> = ({
  coordinates,
  eventId,
  title,
  emoji,
  isPrivate,
  eventDate,
  imageUrl,
  imageLoading,
  imageError,
  onImagePress,
  mapRef,
  cameraRef,
  onMapReady,
}) => {
  return (
    <View style={[styles.eventImage, styles.mapPreview]}>
      <MapboxGL.MapView
        pitchEnabled={false}
        zoomEnabled={false}
        compassEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        scaleBarEnabled={false}
        ref={mapRef}
        style={styles.mapPreview}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={onMapReady}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={coordinates}
          animationDuration={0}
        />

        <MapboxGL.MarkerView
          coordinate={coordinates}
          anchor={{ x: 0.5, y: 1.0 }}
        >
          <EmojiMapMarker
            event={{
              id: eventId,
              coordinates: coordinates,
              data: {
                title,
                emoji,
                isPrivate,
                eventDate,
                color: "#4a148c",
              },
            }}
            isSelected={false}
            onPress={() => {}}
          />
        </MapboxGL.MarkerView>
      </MapboxGL.MapView>

      {/* Image overlay for public events */}
      {!isPrivate &&
        (imageLoading ? (
          <View style={styles.privateEventImageOverlay}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : imageError ? (
          <View style={styles.privateEventImageOverlay}>
            <Text style={styles.privateEventImageError}>{imageError}</Text>
          </View>
        ) : imageUrl ? (
          <TouchableOpacity
            onPress={onImagePress}
            activeOpacity={0.9}
            style={styles.privateEventImageOverlay}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.privateEventImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : null)}
    </View>
  );
};

export default EventMapPreview;
