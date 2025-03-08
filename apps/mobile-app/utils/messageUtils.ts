// utils/messageUtils.ts
import { Marker } from "@/hooks/useMapWebsocket";
import { MessageFlowService } from "./MessageFlowService";

/**
 * Generate a personalized goodbye message based on the marker name
 * @param markerName The name of the last marker viewed
 */
export const generateGoodbyeMessage = (markerName: string = ""): string => {
  return MessageFlowService.getGoodbyeFlow(markerName);
};

/**
 * Generate message sequence based on marker data
 * @param marker The selected marker
 * @param userLocation User coordinates [longitude, latitude]
 */
export const generateMessageSequence = (
  marker: Marker,
  userLocation: [number, number] | null
): string[] => {
  return MessageFlowService.getMarkerDiscoveryFlow(marker, { userLocation });
};

/**
 * Generate action response messages
 * @param action The action type
 * @param userName Optional user name for personalized messages
 * @param coords Optional coordinates for location-based actions
 */
export const generateActionMessages = (
  action: string,
  userName?: string,
  coords?: [number, number] | null
): string[] => {
  return MessageFlowService.getActionFlow(action, { userName, userLocation: coords });
};

/**
 * Determine emoji based on message content
 * @param message The message text
 * @param markerId The marker ID or "goodbye" for goodbye messages
 */
export const getMessageEmoji = (message: string, markerId: string | null = null): string => {
  return MessageFlowService.getMessageEmoji(message, markerId);
};

/**
 * Generate cluster discovery messages based on cluster information
 * @param clusterCount The number of events in the cluster
 * @param userLocation User coordinates [longitude, latitude]
 */
export const generateClusterMessages = (
  clusterCount: number,
  userLocation: [number, number] | null
): string[] => {
  return MessageFlowService.getClusterDiscoveryFlow(clusterCount, { userLocation });
};
