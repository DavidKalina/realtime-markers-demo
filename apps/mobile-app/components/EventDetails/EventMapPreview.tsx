import React from "react";
import { View } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { MapMarker as EmojiMapMarker } from "../Markers/CustomMapMarker";
import { styles } from "./styles";
import { COLORS } from "../Layout/ScreenLayout";

interface EventMapPreviewProps {
  coordinates: [number, number];
  eventId: string;
  title: string;
  emoji: string;
  isPrivate?: boolean;
  eventDate: string;
}

const EventMapPreview: React.FC<EventMapPreviewProps> = ({
  coordinates,
  eventId,
  title,
  emoji,
  isPrivate,
  eventDate,
}) => {
  return (
    <View style={styles.mapPreviewContainer}>
      <MapboxGL.MapView
        pitchEnabled={false}
        zoomEnabled={false}
        compassEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        scaleBarEnabled={false}
        style={styles.mapPreview}
        styleURL={MapboxGL.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera zoomLevel={15} centerCoordinate={coordinates} />

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
                color: COLORS.accent,
              },
            }}
            onPress={() => {}}
          />
        </MapboxGL.MarkerView>
      </MapboxGL.MapView>
    </View>
  );
};

export default EventMapPreview;
