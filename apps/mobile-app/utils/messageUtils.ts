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

// Welcome back messages when returning from navigation
const WELCOME_BACK_MESSAGES = [
  "Welcome back! Would you like to continue exploring?",
  "Glad you're back! What would you like to do next?",
  "Welcome back to the map! Let me know if you need any assistance.",
  "You've returned! Let's continue our exploration.",
  "Nice to see you again! Let's keep exploring.",
];

/**
 * Get a random goodbye message from the list
 */
export const getRandomGoodbyeMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * GOODBYE_MESSAGES.length);
  return GOODBYE_MESSAGES[randomIndex];
};

/**
 * Get a random welcome back message from the list
 */
export const getRandomWelcomeBackMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * WELCOME_BACK_MESSAGES.length);
  return WELCOME_BACK_MESSAGES[randomIndex];
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
 * Generate a welcome back message sequence based on the previous action
 * @param markerName The name of the marker
 * @param previousAction The previous action taken
 */
export const generateWelcomeBackMessage = (
  markerName: string,
  previousAction: string
): string[] => {
  const messages: string[] = [];

  // Add a personalized welcome back message
  messages.push(`Welcome back to ${markerName}!`);

  // Add action-specific messages
  switch (previousAction) {
    case "details":
      messages.push("I hope the details were helpful.");
      break;
    case "share":
      messages.push("Did you successfully share this location with your friends?");
      break;
    case "search":
      messages.push("Did you find what you were looking for?");
      break;
    case "camera":
      messages.push("Did you manage to scan any QR codes?");
      break;
    default:
      messages.push(getRandomWelcomeBackMessage());
      break;
  }

  // Add a final prompt
  messages.push("What would you like to do now?");

  return messages;
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
export const generateActionMessages = (
  action: string,
  name?: string,
  coords?: [number, number] | null
): string[] => {
  // Set appropriate messages based on the action
  switch (action) {
    case "details":
      return ["Opening detailed information about this location."];
    case "share":
      return ["Let's share this place with your friends!"];
    case "search":
      return ["Looking for something specific?"];
    case "camera":
      return ["Camera activated!", "Scan an image of a flyer to get information about an event."];
    case "locate":
      return [`Returning to ${coords?.join(", ")}`];
    case "next":
      return ["Let me show you the next location on your itinerary."];
    case "previous":
      return ["Going back to the previous location."];
    case "user":
      return [`Hey, ${name}.`, "Launching your profile."];
    default:
      return ["How can I help you with this location?"];
  }
};

/**
 * Generate navigation preparation messages
 * @param markerName The name of the marker being navigated from
 */
export const generateNavigationPreparationMessages = (markerName: string): string[] => {
  return [
    `I'll remember our place at ${markerName}.`,
    "You can continue exploring when you return.",
  ];
};

/**
 * Determine emoji based on message content
 * @param message The message text
 * @param markerId The marker ID or "goodbye" for goodbye messages
 */
export const getMessageEmoji = (message: string, markerId: string | null = null): string => {
  const emojiMap: { [key: string]: string } = {
    discovered: "🔭",
    "Welcome back": "👋",
    Welcome: "👋",
    Hey: "👋",
    Returning: "↩️",
    Launching: "🚀",
    time: "⏰",
    "Starts in": "⏰",
    "Happening now": "⏰",
    "meters away": "📍",
    "km away": "📍",
    "Located at": "🗺️",
    verified: "✅",
    "Opening detailed": "📝",
    share: "📲",
    Looking: "🔍",
    Search: "🔍",
    flyer: "📜",
    Camera: "📷",
    next: "⏭️",
    previous: "⏮️",
    Categories: "🏷️",
    "moved away": "👋",
    Goodbye: "👋",
    "How can I help": "💬",
    rating: "⭐",
    remember: "🧠",
    "hope the details were helpful": "📊",
    "successfully share": "🔄",
    "find what you were looking for": "🔍",
    "scan any QR codes": "📲",
    "What would you like to do now": "❓",
  };

  if (markerId === "goodbye") {
    return "👋";
  }

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (message.includes(key)) {
      return emoji;
    }
  }

  return "";
};
