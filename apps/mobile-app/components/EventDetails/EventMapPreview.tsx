import React, { useMemo } from "react";
import { View } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { EmojiMapMarker } from "../Markers/CustomMapMarker";
import { createStyles } from "./styles";
import { useColors } from "@/theme";
import { useMapStyle } from "@/contexts/MapStyleContext";

interface EventMapPreviewProps {
  coordinates: [number, number];
  eventId: string;
  title: string;
  emoji: string;
  eventDate: string;
}

const EventMapPreview: React.FC<EventMapPreviewProps> = ({
  coordinates,
  eventId,
  title,
  emoji,
  eventDate,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mapStyle } = useMapStyle();

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
        styleURL={mapStyle}
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
                eventDate,
                color: colors.accent.primary,
              },
            }}
            isSelected={false}
            onPress={() => {}}
          />
        </MapboxGL.MarkerView>
      </MapboxGL.MapView>
    </View>
  );
};

export default EventMapPreview;
