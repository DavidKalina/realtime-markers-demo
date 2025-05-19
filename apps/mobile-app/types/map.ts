export interface BaseMapItem {
  id: string;
  coordinates: [number, number];
  type: "marker" | "cluster";
}

export interface MarkerItem extends BaseMapItem {
  type: "marker";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; // Replace with your actual marker data type
}

export interface ClusterItem extends BaseMapItem {
  type: "cluster";
  count: number;
  childrenIds?: string[];
}

export type MapItem = MarkerItem | ClusterItem;
