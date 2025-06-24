import React from "react";
import { MapMojiMarker } from "./MapMojiMarker";
import { CivicEngagementMarker } from "./CivicEngagementMarker";
import type { Marker } from "@/hooks/useMapWebsocketWeb";

interface MarkerFactoryProps {
  marker: Marker;
  onPress: () => void;
  isHighlighted?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const MarkerFactory: React.FC<MarkerFactoryProps> = ({
  marker,
  onPress,
  isHighlighted,
  style,
  className,
}) => {
  // Detect type: civic engagement markers have entityType or id prefix
  const isCivic =
    marker.data.entityType === "civic_engagement" ||
    marker.id.startsWith("civic-");
  if (isCivic) {
    return (
      <CivicEngagementMarker
        marker={marker}
        onPress={onPress}
        isHighlighted={isHighlighted}
        style={style}
        className={className}
      />
    );
  }
  // Default: event marker
  return (
    <MapMojiMarker
      event={marker}
      onPress={onPress}
      isHighlighted={isHighlighted}
      style={style}
      className={className}
    />
  );
};
