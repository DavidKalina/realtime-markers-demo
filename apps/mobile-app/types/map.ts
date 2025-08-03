import { Marker } from "@/types/types";

export interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

export interface MarkerItem extends BaseMapItem {
  type: "marker";
  data: Marker["data"];
}

export interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

export type MapItem = MarkerItem | ClusterItem;
