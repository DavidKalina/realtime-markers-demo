import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import { useMarkerStore } from "@/stores/markerStore";
import Mapbox, { MarkerView } from "@rnmapbox/maps";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import AnimatedMarker from "./AnimatedMapMarker";
import MarkerDetailsPopup from "./MarkerDetailsPopup";

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

Mapbox.setAccessToken("YOUR_MAPBOX_ACCESS_TOKEN");

interface MapViewProps {
  style?: object;
  wsUrl: string;
}

export default function MapView({
  style,
  wsUrl = process.env.EXPO_PUBLIC_WEB_SOCKET_URL!,
}: MapViewProps) {
  const [location, setLocation] = useState<[number, number]>([-122.4324, 37.78825]);
  const { updateViewport } = useMapWebSocket(wsUrl);
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Get markers and selection from store
  const markers = useMarkerStore((state) => state.markers);
  const selectedMarker = useMarkerStore((state) => state.selectedMarker);
  const selectMarker = useMarkerStore((state) => state.selectMarker);

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
      cameraRef.current.flyTo(
        [
          selectedMarker.coordinates[0],
          selectedMarker.coordinates[1] - 0.02, // Slight offset to account for popup
        ],
        1000
      );
    }
  }, [selectedMarker]);
  return (
    <>
      <Mapbox.MapView
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

        {markers.map((marker) => (
          <React.Fragment key={marker.id}>
            <MarkerView id={marker.id} coordinate={marker.coordinates}>
              <AnimatedMarker
                emoji={marker.data.emoji}
                isSelected={selectedMarker?.id === marker.id}
                onPress={() => selectMarker(marker.id)}
              />
            </MarkerView>
          </React.Fragment>
        ))}
      </Mapbox.MapView>

      {selectedMarker && (
        <MarkerDetailsPopup marker={{ ...selectedMarker.data, id: selectedMarker.id ?? "" }} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: "#FF4B4B",
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    fontSize: 20,
  },
  calloutContainer: {
    position: "absolute",
    bottom: "100%",
    backgroundColor: "white",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8,
  },
  calloutText: {
    color: "#333",
    fontSize: 14,
  },
});
