import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { useMarkerStore } from "@/stores/markerStore";
import Mapbox, { MarkerView } from "@rnmapbox/maps";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Alert, Linking, Platform } from "react-native";
import GenericMapMarker from "./AnimatedMapMarker";
import { router } from "expo-router";

interface MapboxRegion {
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    bearing: number;
    heading: number;
    pitch: number;
    visibleBounds: [[number, number], [number, number]];
    zoomLevel: number;
    isUserInteraction: boolean;
  };
  type: string;
}

Mapbox.setAccessToken(
  "pk.eyJ1IjoiZGtwcm90b24iLCJhIjoiY203Z3Rscjl5MGJ0ejJscTIwaGEzbmdyMCJ9.NDfmGrns6CzQ3_MmD9c3tQ"
);

interface MapViewProps {
  style?: object;
  wsUrl?: string;
}

export default function MapView({
  style,
  wsUrl = process.env.EXPO_PUBLIC_WEB_SOCKET_URL!,
}: MapViewProps) {
  const [location, setLocation] = useState<[number, number]>([-122.4324, 37.78825]);
  const { updateViewport } = useMapWebSocket(wsUrl);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);

  // Get markers and selection from store
  const markers = useMarkerStore((state) => state.markers);
  const selectedMarker = useMarkerStore((state) => state.selectedMarker);
  const selectMarker = useMarkerStore((state) => state.selectMarker);

  // Get marker information
  const getMarkerInfo = useCallback(
    (markerId: string) => {
      const marker = markers.find((m) => m.id === markerId);
      if (!marker) return null;

      return {
        id: marker.id,
        title: marker.data.title,
        emoji: marker.data.emoji,
        location: {
          latitude: marker.coordinates[1],
          longitude: marker.coordinates[0],
        },
      };
    },
    [markers]
  );

  // Get user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      setLocation([position.coords.longitude, position.coords.latitude]);
    })();
  }, []);

  // Handle map region change
  const onRegionDidChange = useCallback(
    (region: MapboxRegion) => {
      const [[westLng, southLat], [eastLng, northLat]] = region.properties.visibleBounds;

      const viewport = {
        north: Math.max(northLat, southLat),
        south: Math.min(northLat, southLat),
        east: Math.max(eastLng, westLng),
        west: Math.min(eastLng, westLng),
      };

      updateViewport(viewport);
    },
    [updateViewport]
  );

  // When a marker is selected, move the camera to center on it
  useEffect(() => {
    if (selectedMarker && cameraRef.current) {
      cameraRef.current.moveTo([selectedMarker.coordinates[0], selectedMarker.coordinates[1]], 300);
    }
  }, [selectedMarker]);

  // Initialize viewport on component mount
  useEffect(() => {
    // Create an initial viewport based on default location
    const defaultZoomSpan = 0.02;
    const initialViewport = {
      north: location[1] + defaultZoomSpan,
      south: location[1] - defaultZoomSpan,
      east: location[0] + defaultZoomSpan,
      west: location[0] - defaultZoomSpan,
    };

    // Call updateViewport on mount with initial viewport
    updateViewport(initialViewport);
  }, []);

  // Handler for sharing a marker location
  const handleShare = useCallback(
    (markerId: string) => {
      const marker = markers.find((m) => m.id === markerId);
      if (!marker) return;

      const locationString = `${marker.data.title} - https://maps.google.com/?q=${marker.coordinates[1]},${marker.coordinates[0]}`;

      if (Platform.OS === "ios" || Platform.OS === "android") {
        Linking.canOpenURL("sms:")
          .then((canOpen) => {
            if (canOpen) {
              Linking.openURL(`sms:&body=${encodeURIComponent(locationString)}`);
            } else {
              // Fallback to regular share if SMS is not available
              handleFallbackShare(locationString);
            }
          })
          .catch((err) => {
            console.error("Error checking SMS capability:", err);
            handleFallbackShare(locationString);
          });
      }
    },
    [markers]
  );

  // Fallback share method
  const handleFallbackShare = (content: string) => {
    // Use clipboard or other methods as fallback
    Alert.alert("Share Location", "Copy this location to share:", [
      { text: "Copy", onPress: () => {} },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Handler for getting directions to a marker
  const handleGetDirections = useCallback(
    (markerId: string) => {
      const marker = markers.find((m) => m.id === markerId);
      if (!marker) return;

      // URLs for different platforms
      let url: string;
      if (Platform.OS === "ios") {
        // Apple Maps URL format
        url = `http://maps.apple.com/?daddr=${marker.coordinates[1]},${marker.coordinates[0]}`;
      } else {
        // Google Maps URL format (works on Android and web)
        url = `https://www.google.com/maps/dir/?api=1&destination=${marker.coordinates[1]},${marker.coordinates[0]}`;
      }

      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url);
          } else {
            Alert.alert("Navigation Error", "Maps application is not available");
          }
        })
        .catch((error) => {
          Alert.alert("Navigation Error", "Could not open maps application");
          console.error("Error opening maps:", error);
        });
    },
    [markers]
  );

  const handleViewDetails = useCallback((markerId: string) => {
    router.push(`/results?eventId=${markerId}`);
  }, []);

  return (
    <Mapbox.MapView
      scaleBarEnabled={false}
      ref={mapRef}
      rotateEnabled={false}
      style={[styles.map, style]}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      onRegionDidChange={onRegionDidChange as any}
    >
      <Mapbox.Camera
        ref={cameraRef}
        zoomLevel={14}
        centerCoordinate={location}
        animationMode="flyTo"
        animationDuration={2000}
      />

      <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

      {markers
        .filter((marker) => {
          if (!selectedMarker) {
            return marker;
          } else {
            if (selectedMarker.id === marker.id) {
              return marker;
            } else {
              return null;
            }
          }
        })
        .map((marker) => {
          const markerInfo = {
            id: marker.id,
            title: marker.data.title,
            emoji: marker.data.emoji,
            location: {
              latitude: marker.coordinates[1],
              longitude: marker.coordinates[0],
            },
          };

          return (
            <MarkerView key={marker.id} coordinate={marker.coordinates} allowOverlap>
              <GenericMapMarker
                marker={markerInfo}
                isSelected={selectedMarker?.id === marker.id}
                onPress={() => selectMarker(marker.id)}
                onShare={() => handleShare(marker.id)}
                onGetDirections={() => handleGetDirections(marker.id)}
                onViewDetails={() => handleViewDetails(marker.id)}
                onDismiss={() => selectMarker(null)}
              />
            </MarkerView>
          );
        })}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
