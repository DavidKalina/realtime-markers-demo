// utils/MessageFlowService.ts
import { Marker } from "@/hooks/useMapWebsocket";
import { calculateDistance, formatDistance } from "./distanceUtils";
import { formatTimeInfo } from "./timeUtils";

/**
 * Interface for message flow options
 */
export interface MessageFlowOptions {
  userName?: string;
  userLocation?: [number, number] | null;
  isFirstTimeUser?: boolean;
}

/**
 * Emoji mapping for message content
 * Ensure each flow has text that matches these keys
 */
const EMOJI_MAP: Record<string, string> = {
  discovered: "🔭",
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
  attractions: "🎢",
  Looking: "🔍",
  Search: "🔍",
  flyer: "📜",
  Camera: "📷",
  Scanner: "📷",
  next: "⏭️",
  previous: "⏮️",
  Categories: "🏷️",
  "moved away": "👋",
  Goodbye: "👋",
  "How can I help": "💬",
  rating: "⭐",
  remember: "🧠",
  saved: "🔖",
  bookmarked: "🔖",
  favorites: "❤️",
  "found a hotspot": "🔥",
  "found a group": "📍",
  "major event hub": "🌟",
  "several interesting events": "🎭",
  "interesting events": "📅",
  "events are happening": "📅",
  "events are taking place": "📅",
  "group of": "👥",
  hotspot: "🔥",
  "event hub": "🌟",
};

/**
 * Goodbye messages when a marker is deselected
 * All include "Goodbye" to match the emoji mapping
 */
const GOODBYE_MESSAGES = [
  "Goodbye for now! See you next time! Let me know if you want to explore more locations.",
  "Goodbye! I'll be here when you're ready to discover more places!",
  "Goodbye! Until next time! Looking forward to your next exploration.",
  "Goodbye for now! Tap any marker to learn about other places.",
  "Goodbye from this location. Let me know when you're ready for more!",
];

/**
 * Class for managing message flows in the application
 */
export class MessageFlowService {
  /**
   * Generates first-time welcome message flow
   * @param options Message flow options
   * @returns Array of welcome messages
   */
  static getFirstTimeWelcomeFlow(options: MessageFlowOptions = {}): string[] {
    const { userName } = options;
    const messages: string[] = [];

    if (userName) {
      messages.push(`Welcome, ${userName}! 👋`);
    } else {
      messages.push("Welcome to EventExplorer! 👋");
    }

    messages.push("I'm your personal event assistant.");
    messages.push("Tap on any marker to discover events and attractions near you.");
    messages.push("Use the action buttons below to search for events, scan event flyers");
    messages.push("or launch your profile.");

    return messages;
  }

  /**
   * Generates a marker discovery message flow
   * @param marker The selected marker
   * @param options Message flow options
   * @returns Array of marker discovery messages
   */
  static getMarkerDiscoveryFlow(marker: Marker, options: MessageFlowOptions = {}): string[] {
    const { userLocation } = options;

    // Safety check
    if (!marker || !marker.data) {
      return ["Sorry, I couldn't load information about this location."];
    }

    const title = marker.data?.title || "this location";
    const type =
      marker.data?.categories?.[0] || marker.data?.category || marker.data?.type || "place";

    // Calculate distance from user
    const distance = calculateDistance(userLocation ?? [0, 1], marker.coordinates);

    // Format time information
    const timeInfo = formatTimeInfo(marker.data?.time);

    // Get location name

    // Create an array of messages to be displayed in sequence
    const messages = [`You discovered ${title}!`];

    // Add time information if available
    if (timeInfo) {
      // Format time message to match emoji map keys
      if (timeInfo.includes("starting")) {
        messages.push(timeInfo.replace("starting", "Starts in"));
      } else if (timeInfo.includes("ongoing")) {
        messages.push(timeInfo.replace("ongoing", "Happening now"));
      } else {
        messages.push(`time: ${timeInfo}`);
      }
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

    return messages;
  }

  /**
   * Generates a goodbye message when a marker is deselected
   * @param markerName The name of the marker being deselected
   * @returns Goodbye message
   */
  static getGoodbyeFlow(markerName: string = ""): string {
    const randomIndex = Math.floor(Math.random() * GOODBYE_MESSAGES.length);
    const randomMessage = GOODBYE_MESSAGES[randomIndex];

    if (markerName) {
      return `You've moved away from ${markerName}. ${randomMessage}`;
    }
    return randomMessage;
  }

  /**
   * Generates messages for specific user actions
   * @param action The action type
   * @param options Message flow options
   * @returns Array of action-specific messages
   */
  static getActionFlow(action: string, options: MessageFlowOptions = {}): string[] {
    const { userName, userLocation } = options;

    // Set appropriate messages based on the action
    switch (action) {
      case "details":
        return ["Opening detailed information about this location."];
      case "share":
        return ["Let's share this place with your friends!"];
      case "search":
        return ["Looking for something specific?"];
      case "camera":
        return ["Scanner activated!"];
      case "locate":
        return [`Returning to ${userLocation?.join(", ") || "your location"}`];
      case "next":
        return ["Let me show you the next event on your itinerary."];
      case "previous":
        return ["Going back to the previous location."];
      case "user":
        return ["Launching your profile."];
      case "saved":
        return ["Let's see what you've bookmarked for later."];
      default:
        return ["How can I help you with this location?"];
    }
  }

  // utils/MessageFlowService.ts - Add this new method to your MessageFlowService class

  /**
   * Generates a cluster discovery message flow
   * @param clusterCount The number of events in the cluster
   * @param options Message flow options
   * @returns Array of cluster discovery messages
   */
  static getClusterDiscoveryFlow(clusterCount: number, options: MessageFlowOptions = {}): string[] {
    const { userLocation } = options;
    const messages: string[] = [];

    // Cluster discovery message
    if (clusterCount > 10) {
      messages.push(`You've found a hotspot with ${clusterCount} events!`);
    } else {
      messages.push(`You've found a group of ${clusterCount} events!`);
    }

    // Different message based on cluster size
    if (clusterCount > 20) {
      messages.push("This is a major event hub with lots of activities.");
    } else if (clusterCount > 10) {
      messages.push("This location hosts several interesting events.");
    } else if (clusterCount > 5) {
      messages.push("A few interesting events are happening at this location.");
    } else {
      messages.push("A couple of events are taking place here.");
    }

    return messages;
  }

  /**
   * Get appropriate emoji for a message based on its content
   * @param message The message text
   * @param specialContext Optional special context (e.g., "goodbye")
   * @returns Appropriate emoji or empty string if no match
   */
  static getMessageEmoji(message: string, specialContext: string | null = null): string {
    if (specialContext === "goodbye") {
      return "👋";
    }

    for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
      if (message.includes(key)) {
        return emoji;
      }
    }

    // Default emoji based on message context if no direct match found
    if (message.includes("rating")) return "⭐";
    if (message.includes("assistant")) return "🤖";

    return "";
  }
}
