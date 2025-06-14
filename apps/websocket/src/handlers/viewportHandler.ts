import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types/websocket";

export interface ViewportData {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface FormattedViewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportValidationResult {
  isValid: boolean;
  error?: string;
  viewport?: FormattedViewport;
}

export function validateAndFormatViewport(
  viewportData: unknown,
  clientId: string,
): ViewportValidationResult {
  if (!viewportData || typeof viewportData !== "object") {
    return {
      isValid: false,
      error: `Invalid viewport data from client ${clientId}`,
    };
  }

  const viewport = viewportData as ViewportData;

  // Check for required properties
  if (
    typeof viewport.west !== "number" ||
    typeof viewport.south !== "number" ||
    typeof viewport.east !== "number" ||
    typeof viewport.north !== "number"
  ) {
    return {
      isValid: false,
      error: `Invalid viewport coordinates from client ${clientId}`,
    };
  }

  // Validate coordinate ranges
  if (viewport.west < -180 || viewport.west > 180) {
    return {
      isValid: false,
      error: `Invalid west coordinate: ${viewport.west}`,
    };
  }

  if (viewport.east < -180 || viewport.east > 180) {
    return {
      isValid: false,
      error: `Invalid east coordinate: ${viewport.east}`,
    };
  }

  if (viewport.south < -90 || viewport.south > 90) {
    return {
      isValid: false,
      error: `Invalid south coordinate: ${viewport.south}`,
    };
  }

  if (viewport.north < -90 || viewport.north > 90) {
    return {
      isValid: false,
      error: `Invalid north coordinate: ${viewport.north}`,
    };
  }

  // Validate that west < east and south < north
  if (viewport.west >= viewport.east) {
    return {
      isValid: false,
      error: `West coordinate (${viewport.west}) must be less than east coordinate (${viewport.east})`,
    };
  }

  if (viewport.south >= viewport.north) {
    return {
      isValid: false,
      error: `South coordinate (${viewport.south}) must be less than north coordinate (${viewport.north})`,
    };
  }

  return {
    isValid: true,
    viewport: {
      minX: viewport.west,
      minY: viewport.south,
      maxX: viewport.east,
      maxY: viewport.north,
    },
  };
}

export function handleViewportUpdate(
  ws: ServerWebSocket<WebSocketData>,
  viewportData: unknown,
  updateViewport: (
    userId: string,
    viewport: FormattedViewport,
  ) => Promise<void>,
): Promise<void> {
  const userId = ws.data.userId;

  if (!userId) {
    console.warn(
      `Viewport update received from unidentified client ${ws.data.clientId}`,
    );
    return Promise.resolve();
  }

  const validation = validateAndFormatViewport(viewportData, ws.data.clientId);

  if (!validation.isValid) {
    console.error(validation.error);
    return Promise.resolve();
  }

  return updateViewport(userId, validation.viewport!);
}
