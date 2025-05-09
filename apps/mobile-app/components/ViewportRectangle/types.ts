import { MapboxViewport } from "@/types/types";

export interface ViewportRectangleProps {
  viewport: MapboxViewport | null;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  debug?: boolean;
}
