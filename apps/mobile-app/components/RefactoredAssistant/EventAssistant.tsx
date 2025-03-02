// Update in EventAssistant.tsx - Pass isStandalone prop to ActionBar
import { useLocationStore } from "@/stores/useLocationStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, Animated as RNAnimated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionBar } from "./ActionBar";
import { FloatingEmojiWithStore } from "./FloatingEmoji";
import { MessageBubble } from "./MessageBubble";
import { styles } from "./styles";
import { ActionView } from "./ActionView";
import { Navigation, Share2, Search, LinkIcon } from "lucide-react-native";
import EventDetails from "./EventDetails";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter(); // Initialize navigation hook

  // Animation value for the assistant (legacy)
  const assistantAnimation = useRef(new RNAnimated.Value(0)).current;

  // New Reanimated shared values for better animations
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(50);
  const cardHeight = useSharedValue(0);

  // Use shared value for standalone mode to control timing
  const isCardHidden = useSharedValue(true);

  // Get text streaming store state and functions
  const { currentStreamedText, isTyping, simulateTextStreaming, setCurrentEmoji, resetText } =
    useTextStreamingStore();

  // State to track message queue and processing status
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [processingQueue, setProcessingQueue] = useState(false);

  const [lastProcessedMarkerId, setLastProcessedMarkerId] = useState<string | null>(null);

  const {
    activeView,
    detailsViewVisible,
    shareViewVisible,
    searchViewVisible,
    scanViewVisible,
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
  const generateMessageSequence = (marker: any): string[] => {
    // Safety check
    if (!marker || !marker.data) {
      return ["Sorry, I couldn't load information about this location."];
    }

    const title = marker.data?.title || "this location";
    const type = marker.data?.category || marker.data?.type || "place";
    const time = marker.data?.time || "";

    // Create an array of messages to be displayed in sequence
    const messages = [`Welcome to ${title}! 👋`, `This ${type} is one of our featured locations.`];

    // Add conditional messages based on marker data
    if (time) {
      messages.push(`The best time to visit is ${time}.`);
    }

    if (marker.data?.rating) {
      messages.push(`It has a rating of ${marker.data.rating}/5 stars based on visitor reviews.`);
    }

    if (marker.data?.description) {
      messages.push(marker.data.description);
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
        return [
          "Let's share this place with your friends! You can send via message or social media.",
        ];
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

  // Process message queue one by one
  useEffect(() => {
    const processQueue = async () => {
      if (messageQueue.length > 0 && !processingQueue) {
        setProcessingQueue(true);

        // Get the first message from the queue
        const nextMessage = messageQueue[0];

        // Remove the processed message from the queue
        const updatedQueue = [...messageQueue];
        updatedQueue.shift();
        setMessageQueue(updatedQueue);

        // Set appropriate emoji based on message content
        if (nextMessage.includes("Welcome")) {
          setCurrentEmoji("👋");
        } else if (nextMessage.includes("rating")) {
          setCurrentEmoji("⭐");
        } else if (nextMessage.includes("time")) {
          setCurrentEmoji("⏰");
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
        } else {
          setCurrentEmoji("");
        }

        // Stream the message
        await simulateTextStreaming(nextMessage);

        // Add a delay between messages
        await new Promise((resolve) => setTimeout(resolve, 500));

        setProcessingQueue(false);
      }
    };

    processQueue();
  }, [messageQueue, processingQueue, simulateTextStreaming, setCurrentEmoji]);

  // When selected marker changes, update message queue and animate
  useEffect(() => {
    // Only process if there's a selected marker and it's different from the last one we processed
    if (selectedMarker && selectedMarkerId !== lastProcessedMarkerId) {
      try {
        console.log("Processing new marker selection:", selectedMarkerId);

        // Reset text before starting new sequence
        resetText();

        // Generate message sequence and set to queue
        const messages = generateMessageSequence(selectedMarker);
        setMessageQueue(messages);

        // Track that we've processed this marker
        setLastProcessedMarkerId(selectedMarkerId);

        // Mark card as visible immediately for styling
        isCardHidden.value = false;

        // Animate with Reanimated - smoother physics-based animations
        // First animate height to create space
        cardHeight.value = withTiming(
          120,
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
        setMessageQueue(["Sorry, I couldn't load information about this location."]);
      }
    } else if (!selectedMarker && lastProcessedMarkerId !== null) {
      // Marker was deselected
      resetText();
      setMessageQueue([]);
      setLastProcessedMarkerId(null);

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
        }
      );

      // Legacy animation for backwards compatibility
      RNAnimated.timing(assistantAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [
    selectedMarker,
    selectedMarkerId,
    resetText,
    assistantAnimation,
    cardOpacity,
    cardTranslateY,
    cardHeight,
    isCardHidden,
  ]);

  // Handle action button presses
  const onActionPress = (action: string) => {
    console.log(selectedMarker);

    // Skip actions if no current event is selected
    if (!selectedMarker && ["details", "share"].includes(action)) {
      resetText();
      setMessageQueue(["Please select a location first."]);

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
      setTimeout(() => {
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

    // Generate and queue action response messages
    const actionMessages = generateActionMessages(action);

    // Reset text and set new queue
    resetText();
    setMessageQueue(actionMessages);

    // Perform the actual action
    if (action === "details") {
      openDetailsView();
    } else if (action === "share") {
      openShareView();
    } else if (action === "search") {
      openSearchView();
    } else if (action === "camera") {
      // Navigate to the scan screen instead of opening a view
      navigate("scan" as never);
    }
  };

  // Close view handlers with response messages
  const handleCloseDetailsView = () => {
    closeDetailsView();

    // If there's a selected marker, return to showing its information
    if (selectedMarker) {
      const messages = ["Returning to location overview."];
      resetText();
      setMessageQueue(messages);
    }
  };

  const handleCloseShareView = () => {
    closeShareView();

    // Return to marker information
    if (selectedMarker) {
      const messages = ["Sharing cancelled. How else can I help you with this location?"];
      resetText();
      setMessageQueue(messages);
    }
  };

  const handleCloseSearchView = () => {
    closeSearchView();

    if (selectedMarker) {
      const messages = [
        "Search closed. Let me know if you need anything else about this location.",
      ];
      resetText();
      setMessageQueue(messages);
    }
  };

  const handleCloseScanView = () => {
    closeScanView();

    if (selectedMarker) {
      const messages = ["Camera closed. Returning to location information."];
      resetText();
      setMessageQueue(messages);
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

  // Render share view content
  const renderShareContent = () => {
    if (!selectedMarker) {
      return (
        <View>
          <Text>No event selected to share</Text>
        </View>
      );
    }

    return (
      <View style={styles.actionContent}>
        <Text style={styles.eventTitle}>{selectedMarker.data?.title || "Event"}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Share Options</Text>

          <TouchableOpacity>
            <LinkIcon size={20} color="#4dabf7" />
            <Text>Copy Link</Text>
          </TouchableOpacity>

          <TouchableOpacity>
            <Share2 size={20} color="#4dabf7" />
            <Text>Share to Social Media</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Create share view footer button
  const shareFooterButton = (
    <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={shareEvent}>
      <Share2 size={16} color="#FFFFFF" style={styles.buttonIcon} />
      <Text style={styles.primaryButtonText}>Share Now</Text>
    </TouchableOpacity>
  );

  // Render search view content
  const renderSearchContent = () => {
    return (
      <View style={styles.actionContent}>
        <Text style={styles.sectionTitle}>Search Nearby Locations</Text>

        {/* Search input would go here */}
        <View>
          <Search size={20} color="#4dabf7" />
          <Text>Search locations...</Text>
        </View>

        {/* Search results would go here */}
        <View>
          <Text style={styles.label}>Popular Searches</Text>

          <TouchableOpacity>
            <Text>Restaurants</Text>
          </TouchableOpacity>

          <TouchableOpacity>
            <Text>Museums</Text>
          </TouchableOpacity>

          <TouchableOpacity>
            <Text>Parks</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Legacy animations from RN Animated
  const translateY = assistantAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0], // Start 50px below and animate up
  });
  const opacity = assistantAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // New Reanimated animation styles - more performant, runs on UI thread
  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
    };
  });

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
        <ActionView
          isVisible={shareViewVisible}
          title="Share Event"
          onClose={handleCloseShareView}
          footer={shareFooterButton}
        >
          {renderShareContent()}
        </ActionView>
      )}

      {/* Search View */}
      {activeView === "search" && (
        <ActionView isVisible={searchViewVisible} title="Search" onClose={handleCloseSearchView}>
          {renderSearchContent()}
        </ActionView>
      )}

      <View style={styles.innerContainer}>
        {/* Always render the card container, but animate its height */}
        <Animated.View style={[styles.card, animatedCardContainerStyle]}>
          {/* Inner animated container for the assistant components */}
          <Animated.View style={[styles.row, animatedCardStyle]}>
            <FloatingEmojiWithStore />
            <MessageBubble message={currentStreamedText} isTyping={isTyping} />
          </Animated.View>
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
