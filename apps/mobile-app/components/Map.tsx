import { useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import Mapbox from "@rnmapbox/maps";
import * as Location from "expo-location";

// Initialize Mapbox
Mapbox.setAccessToken(
  "pk.eyJ1IjoiZGtwcm90b24iLCJhIjoiY203aDVwcXBuMDFyMDJub2l0bzUxbHgxYSJ9.1PJbVQGOpkyRfPDhe2wsNw"
);

interface MapViewProps {
  // Add any custom props you need
  style?: object;
}

export default function MapView({ style }: MapViewProps) {
  const [location, setLocation] = useState<[number, number]>([-122.4324, 37.78825]); // Default to SF

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

  return (
    <Mapbox.MapView
      style={[styles.map, style]}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
    >
      <Mapbox.Camera
        zoomLevel={14}
        centerCoordinate={location}
        animationMode="flyTo"
        animationDuration={2000}
      />

      {/* User Location */}
      <Mapbox.UserLocation visible={true} showsUserHeadingIndicator={true} />

      {/* Example Point Annotation */}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
