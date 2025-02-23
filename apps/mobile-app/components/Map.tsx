import { useState, useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import Mapbox from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useMapWebSocket } from "@/hooks/useMapWebsocket";

Mapbox.setAccessToken(
  "pk.eyJ1IjoiZGtwcm90b24iLCJhIjoiY203aDVwcXBuMDFyMDJub2l0bzUxbHgxYSJ9.1PJbVQGOpkyRfPDhe2wsNw"
);

interface MapViewProps {
  style?: object;
  wsUrl: string;
}

export default function MapView({ style, wsUrl }: MapViewProps) {
  const [location, setLocation] = useState<[number, number]>([-122.4324, 37.78825]);
  const { markers, updateViewport } = useMapWebSocket(wsUrl);

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
    (region: any) => {
      updateViewport({
        north: region.properties.visibleBounds[3],
        south: region.properties.visibleBounds[1],
        east: region.properties.visibleBounds[2],
        west: region.properties.visibleBounds[0],
      });
    },
    [updateViewport]
  );

  return (
    <Mapbox.MapView
      style={[styles.map, style]}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      onRegionDidChange={onRegionDidChange}
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
        <Mapbox.PointAnnotation key={marker.id} id={marker.id} coordinate={marker.coordinates}>
          <Mapbox.Callout title={marker.data.emoji} />
        </Mapbox.PointAnnotation>
      ))}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
