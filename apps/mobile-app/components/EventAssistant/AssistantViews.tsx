// components/AssistantViews.tsx
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Navigation, Share2 } from "lucide-react-native";
import { ActionView } from "../ActionView/ActionView";
import EventDetails from "../EventDetails/EventDetails";
import ShareEvent from "../ShareEvent/ShareEvent";
import { styles } from "../globalStyles";
import { Marker } from "@/hooks/useMapWebsocket";

interface AssistantViewsProps {
  activeView: string;
  detailsViewVisible: boolean;
  shareViewVisible: boolean;
  selectedMarker: Marker | null;

  // Event handlers
  onCloseDetailsView: () => void;
  onCloseShareView: () => void;
  onShareEvent: () => void;
}

/**
 * Component to manage all modal views used by the assistant
 */
const AssistantViews: React.FC<AssistantViewsProps> = ({
  activeView,
  detailsViewVisible,
  shareViewVisible,
  selectedMarker,
  onCloseDetailsView,
  onCloseShareView,
  onShareEvent,
}) => {
  // The current event ID comes from the selected marker
  const eventId = selectedMarker?.id || "";

  // Create details view footer buttons
  const detailsFooterButtons = (
    <>
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onShareEvent}>
        <Share2 size={16} color="#f8f9fa" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>Share</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => {}}>
        <Navigation size={16} color="#FFFFFF" style={styles.buttonIcon} />
        <Text style={styles.primaryButtonText}>Directions</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      {/* Details View */}
      {activeView === "details" && (
        <ActionView
          isVisible={detailsViewVisible}
          title="Event Details"
          onClose={onCloseDetailsView}
          footer={detailsFooterButtons}
        >
          <EventDetails eventId={eventId} />
        </ActionView>
      )}

      {/* Share View */}
      {activeView === "share" && selectedMarker && (
        <ActionView isVisible={shareViewVisible} title="Share Event" onClose={onCloseShareView}>
          <ShareEvent eventId={selectedMarker.id} onClose={onCloseShareView} />
        </ActionView>
      )}
    </>
  );
};

export default AssistantViews;
