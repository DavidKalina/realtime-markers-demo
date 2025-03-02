// Updated EventAssistant.tsx using the ActionView component and refactored EventDetails
import { useLocationStore } from "@/stores/useLocationStore";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionBar } from "./ActionBar";
import { FloatingEmojiWithStore } from "./FloatingEmoji";
import { MessageBubble } from "./MessageBubble";
import { styles } from "./styles";
import { ActionView } from "./ActionView";
import { Navigation, Share2, Camera, Search, LinkIcon } from "lucide-react-native";
import EventDetails from "./EventDetails";
import ScanView from "./ScanView";

const EventAssistant: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Get location store state

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

  // When selected marker changes, update message queue
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

        // Reset last action since we're displaying marker information now

        // Track that we've processed this marker
        setLastProcessedMarkerId(selectedMarkerId);
      } catch (error) {
        console.error("Error processing selected marker:", error);
        setMessageQueue(["Sorry, I couldn't load information about this location."]);
      }
    } else if (!selectedMarker && lastProcessedMarkerId !== null) {
      // Marker was deselected
      resetText();
      setMessageQueue([]);
      setLastProcessedMarkerId(null);
    }
  }, [selectedMarker, selectedMarkerId, resetText]);

  // Handle action button presses
  const onActionPress = (action: string) => {
    console.log(selectedMarker);

    // Skip actions if no current event is selected
    if (!selectedMarker && ["details", "share"].includes(action)) {
      resetText();
      setMessageQueue(["Please select a location first."]);
      return;
    }

    // Store the last action performed

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
      openScanView();
    }
  };

  // Close view handlers with response messages
  const handleCloseDetailsView = () => {
    closeDetailsView();

    // Reset last action

    // If there's a selected marker, return to showing its information
    if (selectedMarker) {
      const messages = ["Returning to location overview."];
      resetText();
      setMessageQueue(messages);
    }
  };

  const handleCloseShareView = () => {
    closeShareView();

    // Reset last action

    // Return to marker information
    if (selectedMarker) {
      const messages = ["Sharing cancelled. How else can I help you with this location?"];
      resetText();
      setMessageQueue(messages);
    }
  };

  const handleCloseSearchView = () => {
    closeSearchView();

    // Reset last action

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

    // Reset last action

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

  // No longer needed - ScanView component handles all this internally

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

      {/* Scan View */}
      {activeView === "camera" && (
        <ActionView
          isVisible={scanViewVisible}
          title="Scan Event Flyer"
          onClose={handleCloseScanView}
        >
          <ScanView
            onUploadSuccess={(eventData) => {
              // Handle successful upload
              console.log("Upload successful", eventData);

              // Close the scan view after successful upload
              setTimeout(() => {
                handleCloseScanView();

                // Show a success message in the chat bubble
                resetText();
                setMessageQueue([
                  "Successfully scanned event details!",
                  `Found: ${eventData.title}`,
                  "Would you like to see more information about this event?",
                ]);
              }, 2000);
            }}
          />
        </ActionView>
      )}

      <View style={styles.innerContainer}>
        <View style={styles.card}>
          <View style={styles.row}>
            <FloatingEmojiWithStore />
            <MessageBubble message={currentStreamedText} isTyping={isTyping} />
          </View>
          <ActionBar onActionPress={onActionPress} />
        </View>
      </View>
    </View>
  );
};

export default EventAssistant;
