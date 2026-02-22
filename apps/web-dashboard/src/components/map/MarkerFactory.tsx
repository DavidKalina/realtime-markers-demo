import React from "react";
import { MapMojiMarker } from "./MapMojiMarker";
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
