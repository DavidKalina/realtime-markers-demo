// EventAssistant.tsx - Enhanced with goodbye message
import { useLocationStore } from "@/stores/useLocationStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import { useRouter } from "expo-router";
import { Navigation, Share2 } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated as RNAnimated, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionBar } from "../ActionBar/ActionBar";
import { ActionView } from "../ActionView/ActionView";
import EventDetails from "../EventDetails/EventDetails";
import { FloatingEmoji } from "../EventAssistantEmoji/FloatingEmoji";
import { MessageBubble } from "../MessageBubble/MessageBubble";
import { styles } from "../globalStyles";

import { Marker } from "@/hooks/useMapWebsocket";
import { useUserLocation } from "@/hooks/useUserLocation";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import ShareEvent from "../ShareEvent/ShareEvent";

// Helper function to calculate distance between two coordinates
const calculateDistance = (
  userCoords: [number, number] | null,
  markerCoords: [number, number]
): number | null => {
  if (!userCoords) return null;

  // Convert longitude and latitude from degrees to radians
  const toRad = (value: number) => (value * Math.PI) / 180;

  // Haversine formula to calculate distance
  const R = 6371; // Earth's radius in km
  const dLon = toRad(markerCoords[0] - userCoords[0]);
  const dLat = toRad(markerCoords[1] - userCoords[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userCoords[1])) *
      Math.cos(toRad(markerCoords[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

// Helper function to format distance in a user-friendly way
const formatDistance = (distance: number | null): string => {
  if (distance === null) return "Unknown distance";

  if (distance < 1) {
    // Convert to meters if less than 1 km
    const meters = Math.round(distance * 1000);
    return `${meters} meters away`;
  } else {
    // Keep in km with one decimal place
    return `${distance.toFixed(1)} km away`;
  }
};

// Helper to format time until event starts or indicates if it's happening now
const formatTimeInfo = (timeString: string | undefined): string => {
  if (!timeString) return "";

  try {
    // This is a simple implementation - you might need to adjust based on your time format
    const eventTime = new Date(timeString);
    const now = new Date();

    // If date is invalid, return the original string
    if (isNaN(eventTime.getTime())) {
      return timeString;
    }

    // Check if event is happening now
    if (now >= eventTime && now <= new Date(eventTime.getTime() + 2 * 60 * 60 * 1000)) {
      // Assuming events last 2 hours
      return "Happening now";
    }

    // Calculate time difference
    const diffMs = eventTime.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `Starts in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) {
      return `Starts in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
      return `Starts in ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    }

    return "Starting soon";
  } catch (e) {
    // If there's any error parsing the time, just return the original
    return timeString;
  }
};

// Goodbye messages when a marker is deselected
const GOODBYE_MESSAGES = [
  "See you next time! Let me know if you want to explore more locations.",
  "I'll be here when you're ready to discover more places!",
  "Until next time! Looking forward to your next exploration.",
  "Goodbye for now! Tap any marker to learn about other places.",
  "That's all for this location. Let me know when you're ready for more!",
];

// Get a random goodbye message
const getRandomGoodbyeMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * GOODBYE_MESSAGES.length);
  return GOODBYE_MESSAGES[randomIndex];
};

// Message queue object with version tracking
interface MessageQueueState {
  messages: string[];
  version: number;
  processing: boolean;
  markerId: string | null;
}

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();

  // Animation value for the assistant (legacy)
  const assistantAnimation = useRef(new RNAnimated.Value(0)).current;

  // New Reanimated shared values for better animations
  const cardOpacity = useSharedValue(1);
  const cardTranslateY = useSharedValue(50);
  const cardHeight = useSharedValue(8);

  // Use shared value for standalone mode to control timing
  const isCardHidden = useSharedValue(true);

  // Get user location using the hook
  const { userLocation } = useUserLocation();

  // Get text streaming store state and functions
  const {
    currentStreamedText,
    isTyping,
    simulateTextStreaming,
    setCurrentEmoji,
    resetText,
    cancelCurrentStreaming,
  } = useTextStreamingStore();

  // Enhanced message queue with version tracking to prevent race conditions
  const [messageQueueState, setMessageQueueState] = useState<MessageQueueState>({
    messages: [],
    version: 0,
    processing: false,
    markerId: null,
  });

  // Create a reference to track the current active marker ID and last marker name
  const currentMarkerIdRef = useRef<string | null>(null);
  const lastMarkerNameRef = useRef<string | "">("");

  const {
    activeView,
    detailsViewVisible,
    shareViewVisible,
    selectedMarker,
    selectedMarkerId,

    openDetailsView,
    closeDetailsView,
    openShareView,
    closeShareView,
    openSearchView,
    closeSearchView,
    openScanView,
    closeScanView,

    shareEvent,
  } = useLocationStore();

  // Generate message sequence based on marker data
  const generateMessageSequence = (marker: Marker): string[] => {
    // Safety check
    if (!marker || !marker.data) {
      return ["Sorry, I couldn't load information about this location."];
    }

    const title = marker.data?.title || "this location";
    // Store the last marker name for goodbye message
    lastMarkerNameRef.current = title;

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

  // Generate action response messages
  const generateActionMessages = (action: string): string[] => {
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

  // Generate a personalized goodbye message based on the last marker viewed
  const generateGoodbyeMessage = (): string => {
    const markerName = lastMarkerNameRef.current;
    if (markerName) {
      return `You've moved away from ${markerName}. ${getRandomGoodbyeMessage()}`;
    }
    return getRandomGoodbyeMessage();
  };

  // Function to completely clear and reset messaging state - returns a Promise
  const clearMessageQueue = async () => {
    // Cancel any ongoing streaming first and wait for it to complete
    await cancelCurrentStreaming();

    // Update queue state with new version
    setMessageQueueState((prevState) => ({
      messages: [],
      version: prevState.version + 1,
      processing: false,
      markerId: null,
    }));

    // Reset emoji (will be set again in the next message processing)
    setCurrentEmoji("");
  };

  // Set new message queue with version tracking
  const setNewMessages = (messages: string[], markerId: string | null = null) => {
    setMessageQueueState((prevState) => ({
      messages: [...messages], // Create new array to ensure state change detection
      version: prevState.version + 1, // Increment version to invalidate any ongoing processing
      processing: false,
      markerId,
    }));
  };

  // Process message queue one by one with version checking
  useEffect(() => {
    const processQueue = async () => {
      // Get local copies of state to prevent closure issues
      const { messages, version, processing, markerId } = messageQueueState;

      // Skip if queue is empty or already processing
      if (messages.length === 0 || processing) {
        return;
      }

      // Skip if the marker ID doesn't match current active marker
      if (markerId !== null && markerId !== currentMarkerIdRef.current && markerId !== "goodbye") {
        console.log("Skipping message processing - marker ID mismatch");
        return;
      }

      // Mark as processing
      setMessageQueueState((prevState) => ({
        ...prevState,
        processing: true,
      }));

      // Capture current version for comparison
      const currentVersion = version;

      // Get the first message
      const nextMessage = messages[0];

      // Set appropriate emoji based on message content
      if (nextMessage.includes("discovered")) {
        setCurrentEmoji("🔭");
      } else if (nextMessage.includes("Welcome")) {
        setCurrentEmoji("👋");
      } else if (
        nextMessage.includes("time") ||
        nextMessage.includes("Starts in") ||
        nextMessage.includes("Happening now")
      ) {
        setCurrentEmoji("⏰");
      } else if (nextMessage.includes("meters away") || nextMessage.includes("km away")) {
        setCurrentEmoji("📍");
      } else if (nextMessage.includes("Located at")) {
        setCurrentEmoji("🗺️");
      } else if (nextMessage.includes("verified")) {
        setCurrentEmoji("✅");
      } else if (nextMessage.includes("Opening detailed")) {
        setCurrentEmoji("📝");
      } else if (nextMessage.includes("share")) {
        setCurrentEmoji("📲");
      } else if (nextMessage.includes("search")) {
        setCurrentEmoji("🔍");
      } else if (nextMessage.includes("Camera")) {
        setCurrentEmoji("📷");
      } else if (nextMessage.includes("next")) {
        setCurrentEmoji("⏭️");
      } else if (nextMessage.includes("previous")) {
        setCurrentEmoji("⏮️");
      } else if (nextMessage.includes("Categories")) {
        setCurrentEmoji("🏷️");
      } else if (
        nextMessage.includes("moved away") ||
        nextMessage.includes("Goodbye") ||
        markerId === "goodbye"
      ) {
        // For goodbye messages
        setCurrentEmoji("👋");
      } else {
        setCurrentEmoji("");
      }

      try {
        // Stream the message
        await simulateTextStreaming(nextMessage);

        // Check if version is still the same after streaming completes
        // If not, we've been superseded by a newer message queue
        if (currentVersion !== messageQueueState.version) {
          console.log("Message queue version changed during processing, stopping");
          return;
        }

        // Remove the processed message from the queue
        setMessageQueueState((prevState) => {
          // Double-check version again to prevent race conditions
          if (prevState.version !== currentVersion) {
            return prevState; // No change if version mismatch
          }

          // If queue is now empty, just mark as not processing
          if (prevState.messages.length <= 1) {
            return {
              ...prevState,
              messages: [],
              processing: false,
            };
          }

          // Otherwise remove first message and continue processing
          return {
            ...prevState,
            messages: prevState.messages.slice(1),
            processing: false,
          };
        });

        // Add a delay between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Error processing message:", error);

        // Reset processing status on error
        setMessageQueueState((prevState) => ({
          ...prevState,
          processing: false,
        }));
      }
    };

    processQueue();
  }, [messageQueueState, simulateTextStreaming, setCurrentEmoji]);

  // Update currentMarkerIdRef when selectedMarkerId changes
  useEffect(() => {
    // Note: we need to keep track of marker deselection
    const wasMarkerSelected = Boolean(currentMarkerIdRef.current);
    const isMarkerSelected = Boolean(selectedMarkerId);

    // If we just deselected a marker, we'll want to show a goodbye message
    const markerDeselected = wasMarkerSelected && !isMarkerSelected;

    // Update our reference
    currentMarkerIdRef.current = selectedMarkerId;

    // Handle marker deselection with goodbye message
    if (markerDeselected) {
      // We'll handle this in the marker change effect
    }
  }, [selectedMarkerId]);

  // When selected marker changes, update message queue and animate
  useEffect(() => {
    // Use an async effect function to allow for awaiting clearMessageQueue
    const handleMarkerChange = async () => {
      // Check if this is a marker deselection (we had a marker before, now we don't)
      const wasMarkerSelected = Boolean(currentMarkerIdRef.current);
      const isMarkerSelected = Boolean(selectedMarkerId);
      const markerDeselected = wasMarkerSelected && !isMarkerSelected;

      // Always clear existing queue when marker selection changes
      await clearMessageQueue();

      // Show goodbye message if a marker was deselected
      if (markerDeselected) {
        const goodbyeMessage = generateGoodbyeMessage();

        // Set the goodbye message with special "goodbye" markerId
        setNewMessages([goodbyeMessage], "goodbye");

        // Show the assistant with the goodbye message
        isCardHidden.value = false;

        // Animate with Reanimated
        cardHeight.value = withTiming(
          80,
          {
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          },
          () => {
            cardOpacity.value = withSpring(1, {
              damping: 20,
              stiffness: 90,
            });
            cardTranslateY.value = withSpring(0, {
              damping: 20,
              stiffness: 90,
            });
          }
        );

        // Legacy animation for backwards compatibility
        RNAnimated.spring(assistantAnimation, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 50,
        }).start();

        // Hide after a delay
        setTimeout(async () => {
          // Clear message queue
          await clearMessageQueue();

          // Hide the assistant
          cardOpacity.value = withTiming(0, { duration: 150 });
          cardTranslateY.value = withTiming(20, { duration: 150 }, () => {
            // Then collapse the height
            cardHeight.value = withTiming(
              8,
              {
                duration: 200,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              },
              () => {
                isCardHidden.value = true;
              }
            );
          });

          // Legacy animation
          RNAnimated.timing(assistantAnimation, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start();
        }, 5000); // Show goodbye message for 5 seconds

        return; // Exit early since we've handled the deselection case
      }

      // If there's a selected marker, show its information
      if (selectedMarker && selectedMarkerId) {
        try {
          // Generate message sequence for this marker
          const messages = generateMessageSequence(selectedMarker as Marker);

          // Set new messages with marker ID for tracking
          setNewMessages(messages, selectedMarkerId);

          // Mark card as visible immediately for styling
          isCardHidden.value = false;

          // Animate with Reanimated - smoother physics-based animations
          // First animate height to create space
          cardHeight.value = withTiming(
            80,
            {
              duration: 300,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            },
            () => {
              // Then animate content opacity and position
              cardOpacity.value = withSpring(1, {
                damping: 20,
                stiffness: 90,
              });
              cardTranslateY.value = withSpring(0, {
                damping: 20,
                stiffness: 90,
              });
            }
          );

          // Legacy animation for backwards compatibility
          RNAnimated.spring(assistantAnimation, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 50,
          }).start();
        } catch (error) {
          console.error("Error processing selected marker:", error);
          setNewMessages(["Sorry, I couldn't load information about this location."]);
        }
      } else if (!markerDeselected) {
        // No marker selected and it wasn't a deselection - just hide the assistant

        // Animate with Reanimated - first fade out content
        cardOpacity.value = withTiming(0, {
          duration: 150,
          easing: Easing.out(Easing.ease),
        });
        cardTranslateY.value = withTiming(
          20,
          {
            duration: 150,
            easing: Easing.out(Easing.ease),
          },
          () => {
            // Then collapse the height
            cardHeight.value = withTiming(
              8,
              {
                duration: 200,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              },
              () => {
                // Only mark as hidden after animation completes
                isCardHidden.value = true;
              }
            );
          }
        );

        // Legacy animation for backwards compatibility
        RNAnimated.timing(assistantAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    };

    handleMarkerChange();
  }, [
    selectedMarker,
    selectedMarkerId,
    assistantAnimation,
    cardOpacity,
    cardTranslateY,
    cardHeight,
    isCardHidden,
    userLocation, // Add userLocation as a dependency to recalculate distance when it changes
  ]);

  // Handle action button presses
  const onActionPress = async (action: string) => {
    // Skip actions if no current event is selected for certain actions
    if (!selectedMarker && ["details", "share"].includes(action)) {
      // Clear any existing messages first
      await clearMessageQueue();

      // Set temporary error message
      setNewMessages(["Please select a location first."]);

      // New Reanimated animations for the temporary message
      // Mark card as visible for styling
      isCardHidden.value = false;

      // First show the container
      cardHeight.value = withTiming(
        120,
        {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        () => {
          // Then show the message
          cardOpacity.value = withSpring(1, { damping: 18, stiffness: 80 });
          cardTranslateY.value = withSpring(0, { damping: 18, stiffness: 80 });
        }
      );

      // Hide after delay
      setTimeout(async () => {
        // Clear message queue first
        await clearMessageQueue();

        // First hide the content
        cardOpacity.value = withTiming(0, { duration: 150 });
        cardTranslateY.value = withTiming(20, { duration: 150 }, () => {
          // Then collapse the container
          cardHeight.value = withTiming(
            0,
            {
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            },
            () => {
              // Only mark as hidden after animation completes
              isCardHidden.value = true;
            }
          );
        });
      }, 3000);

      // Legacy animations for backward compatibility
      RNAnimated.sequence([
        RNAnimated.spring(assistantAnimation, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 50,
        }),
        RNAnimated.delay(3000),
        RNAnimated.timing(assistantAnimation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    // Clear existing queue and stop any current streaming
    await clearMessageQueue();

    // Generate and queue action response messages
    const actionMessages = generateActionMessages(action);
    setNewMessages(actionMessages, selectedMarkerId);

    // Perform the actual action
    if (action === "details") {
      openDetailsView();
    } else if (action === "share") {
      openShareView();
    } else if (action === "search") {
      navigate("search" as never);
    } else if (action === "camera") {
      // Navigate to the scan screen instead of opening a view
      navigate("scan" as never);
    }
  };

  // Close view handlers with response messages
  const handleCloseDetailsView = async () => {
    closeDetailsView();

    // Clear existing queue first
    await clearMessageQueue();

    // If there's a selected marker, return to showing its information
    if (selectedMarker) {
      setNewMessages(["Returning to location overview."], selectedMarkerId);
    }
  };

  const handleCloseShareView = async () => {
    closeShareView();

    // Clear existing queue first
    await clearMessageQueue();

    // Return to marker information
    if (selectedMarker) {
      setNewMessages(
        ["Sharing cancelled. How else can I help you with this location?"],
        selectedMarkerId
      );
    }
  };

  // The current event ID comes from the selected marker
  const eventId = selectedMarkerId || "";

  // Create details view footer buttons
  const detailsFooterButtons = (
    <>
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={shareEvent}>
        <Share2 size={16} color="#f8f9fa" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>Share</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => {}}>
        <Navigation size={16} color="#FFFFFF" style={styles.buttonIcon} />
        <Text style={styles.primaryButtonText}>Directions</Text>
      </TouchableOpacity>
    </>
  );

  const animatedCardContainerStyle = useAnimatedStyle(() => {
    return {
      height: cardHeight.value,
      overflow: "hidden",
      // Ensure no border appears when height is animating
      borderTopWidth: 0,
      borderBottomWidth: 0,
      marginBottom: 0,
    };
  });

  // Derived standalone state using Reanimated's shared value
  const isStandalone = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      marginTop: 0,
      marginBottom: 0,
      borderTopWidth: 0,
    };
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Details View */}
      {activeView === "details" && (
        <ActionView
          isVisible={detailsViewVisible}
          title="Event Details"
          onClose={handleCloseDetailsView}
          footer={detailsFooterButtons}
        >
          <EventDetails eventId={eventId} />
        </ActionView>
      )}

      {/* Share View */}
      {activeView === "share" && selectedMarker && (
        <ActionView isVisible={shareViewVisible} title="Share Event" onClose={handleCloseShareView}>
          <ShareEvent eventId={selectedMarker.id} onClose={handleCloseShareView} />
        </ActionView>
      )}

      <View style={styles.innerContainer}>
        {/* Always render the card container, but animate its height */}
        <Animated.View style={[styles.card, animatedCardContainerStyle]}>
          {/* Inner animated container for the assistant components */}
          <View style={[styles.row]}>
            <FloatingEmoji />
            <MessageBubble message={currentStreamedText} isTyping={isTyping} />
          </View>
        </Animated.View>

        {/* Pass the animated style directly to ActionBar */}
        <ActionBar
          onActionPress={onActionPress}
          isStandalone={!selectedMarkerId}
          animatedStyle={isStandalone}
        />
      </View>
    </View>
  );
};

export default EventAssistant;
