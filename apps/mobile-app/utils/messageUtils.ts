// utils/messageUtils.ts
import { Marker } from "@/hooks/useMapWebsocket";
import { calculateDistance, formatDistance } from "./distanceUtils";
import { formatTimeInfo } from "./timeUtils";

// Goodbye messages when a marker is deselected
const GOODBYE_MESSAGES = [
  "See you next time! Let me know if you want to explore more locations.",
  "I'll be here when you're ready to discover more places!",
  "Until next time! Looking forward to your next exploration.",
  "Goodbye for now! Tap any marker to learn about other places.",
  "That's all for this location. Let me know when you're ready for more!",
];

/**
 * Get a random goodbye message from the list
 */
export const getRandomGoodbyeMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * GOODBYE_MESSAGES.length);
  return GOODBYE_MESSAGES[randomIndex];
};

/**
 * Generate a personalized goodbye message based on the marker name
 * @param markerName The name of the last marker viewed
 */
export const generateGoodbyeMessage = (markerName: string = ""): string => {
  if (markerName) {
    return `You've moved away from ${markerName}. ${getRandomGoodbyeMessage()}`;
  }
  return getRandomGoodbyeMessage();
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
  // Safety check
  if (!marker || !marker.data) {
    return ["Sorry, I couldn't load information about this location."];
  }

  const title = marker.data?.title || "this location";
  const type =
    marker.data?.categories?.[0] || marker.data?.category || marker.data?.type || "place";

  // Calculate distance from user
  const distance = calculateDistance(userLocation, marker.coordinates);
  const distanceText = formatDistance(distance);

  // Format time information
  const timeInfo = formatTimeInfo(marker.data?.time);

  // Get location name
  const locationName = marker.data?.location || "";

  // Create an array of messages to be displayed in sequence
  const messages = [`You discovered ${title}❗`];

  // Add location information if available
  if (locationName) {
    messages.push(`Located at ${locationName}`);
  }

  // Add distance information
  if (distance !== null) {
    messages.push(`${distanceText} from your current location`);
  }

  // Add time information if available
  if (timeInfo) {
    messages.push(timeInfo);
  }

  // Add verification status if available
  if (marker.data?.isVerified) {
    messages.push("This is a verified location ✓");
  }

  // Add rating if available
  if (marker.data?.rating) {
    messages.push(`It has a rating of ${marker.data.rating}/5 stars based on visitor reviews.`);
  }

  // Add description if available
  if (marker.data?.description) {
    messages.push(marker.data.description);
  }

  // Show all categories if multiple are available
  if (marker.data?.categories && marker.data.categories.length > 1) {
    messages.push(`Categories: ${marker.data.categories.join(", ")}`);
  }

  messages.push("How can I help you explore this place?");

  return messages;
};

/**
 * Generate action response messages
 * @param action The action type
 */
export const generateActionMessages = (action: string): string[] => {
  // Set appropriate messages based on the action
  switch (action) {
    case "details":
      return ["Opening detailed information about this location."];
    case "share":
      return ["Let's share this place with your friends!"];
    case "search":
      return ["Looking for something specific? You can search nearby locations or events."];
    case "camera":
      return ["Camera activated! Scan a QR code to get information about a location or event."];
    case "next":
      return ["Let me show you the next location on your itinerary."];
    case "previous":
      return ["Going back to the previous location."];
    default:
      return ["How can I help you with this location?"];
  }
};

/**
 * Determine emoji based on message content
 * @param message The message text
 * @param markerId The marker ID or "goodbye" for goodbye messages
 */
export const getMessageEmoji = (message: string, markerId: string | null = null): string | void => {
  if (message.includes("discovered")) {
    return "🔭";
  } else if (message.includes("Welcome")) {
    return "👋";
  } else if (
    message.includes("time") ||
    message.includes("Starts in") ||
    message.includes("Happening now")
  ) {
    return "⏰";
  } else if (message.includes("meters away") || message.includes("km away")) {
    return "📍";
  } else if (message.includes("Located at")) {
    return "🗺️";
  } else if (message.includes("verified")) {
    return "✅";
  } else if (message.includes("Opening detailed")) {
    return "📝";
  } else if (message.includes("share")) {
    return "📲";
  } else if (message.includes("search")) {
    return "🔍";
  } else if (message.includes("Camera")) {
    return "📷";
  } else if (message.includes("next")) {
    return "⏭️";
  } else if (message.includes("previous")) {
    return "⏮️";
  } else if (message.includes("Categories")) {
    return "🏷️";
  } else if (
    message.includes("moved away") ||
    message.includes("Goodbye") ||
    markerId === "goodbye"
  ) {
    return "👋";
  } else if (message.includes("How can I help")) {
    return "💬";
  } else if (message.includes("rating")) {
    return "⭐";
  }
};
