import MapboxGL from "@rnmapbox/maps";
import React, { useMemo } from "react";
import { ViewportRectangleProps } from "./types";

export const ViewportRectangle: React.FC<ViewportRectangleProps> = React.memo(
  ({
    viewport,
    color = "rgba(255, 255, 255, 0.2)",
    borderColor = "rgba(255, 255, 255, 0.5)",
    borderWidth = 2,
    debug = false,
  }) => {
    if (!viewport) return null;

    const coordinates = useMemo(
      () => [
        [viewport.west, viewport.north],
        [viewport.east, viewport.north],
        [viewport.east, viewport.south],
        [viewport.west, viewport.south],
        [viewport.west, viewport.north], // Close the polygon
      ],
      [viewport],
    );

    const shape = useMemo(
      () => ({
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [coordinates],
        },
        properties: {},
      }),
      [coordinates],
    );

    return (
      <MapboxGL.ShapeSource id="viewportRectangle" shape={shape}>
        <MapboxGL.FillLayer
          id="viewportRectangleFill"
          style={{
            fillColor: color,
            fillOpacity: debug ? 0.2 : 0,
          }}
        />
        <MapboxGL.LineLayer
          id="viewportRectangleBorder"
          style={{
            lineColor: borderColor,
            lineWidth: borderWidth,
            lineOpacity: debug ? 0.5 : 0,
          }}
        />
      </MapboxGL.ShapeSource>
    );
  },
);
