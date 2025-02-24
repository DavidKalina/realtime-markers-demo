import { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import Mapbox, { MarkerView } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";
import AnimatedMarker from "./AnimatedMapMarker";

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
  "pk.eyJ1IjoiZGtwcm90b24iLCJhIjoiY203aDVwcXBuMDFyMDJub2l0bzUxbHgxYSJ9.1PJbVQGOpkyRfPDhe2wsNw"
);

interface MapViewProps {
  style?: object;
  wsUrl: string;
}

export default function MapView({
  style,
  wsUrl = "wss://0af6-69-162-231-94.ngrok-free.app",
}: MapViewProps) {
  const [location, setLocation] = useState<[number, number]>([-122.4324, 37.78825]);
  const { markers, updateViewport } = useMapWebSocket(wsUrl);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

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

  return (
    <Mapbox.MapView
      style={[styles.map, style]}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      onRegionDidChange={onRegionDidChange as any}
    >
      <Mapbox.Camera
        zoomLevel={14}
        centerCoordinate={location}
        animationMode="flyTo"
        animationDuration={2000}
      />

      {/* User Location */}
      <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

      {/* Render Markers */}
      {markers.map((marker) => (
        <MarkerView
          key={marker.id}
          id={marker.id}
          coordinate={marker.coordinates}
          anchor={{ x: 0.5, y: 1 }}
        >
          <AnimatedMarker />
        </MarkerView>
      ))}
    </Mapbox.MapView>
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
