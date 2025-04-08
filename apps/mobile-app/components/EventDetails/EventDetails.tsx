import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ErrorEventDetails } from "./ErrorEventDetails";
import EventDetailsHeader from "./EventDetailsHeader";
import LoadingEventDetails from "./LoadingEventDetails";
import NoEventDetailsAvailable from "./NoEventDetailsAvailable";
import SaveCount from "./SaveCount";
import ShareEvent from "./ShareEvent";
import { styles } from "./styles";
import { useEventDetails } from "./useEventDetails";
import AdminOriginalImageViewer from "../AdminOriginalImageViewer/AdminOriginalImageViewer";

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ eventId, onBack }) => {
  const {
    handleBack,
    loading,
    handleGetDirections,
    handleRetry,
    error,
    event,
    handleOpenMaps,
    handleShare,
    handleToggleSave,
    saveCount,
    savingState,
    isAdmin,
    isSaved,
    isLoadingLocation,
    distanceInfo,
    userLocation,
  } = useEventDetails(eventId, onBack);
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
      </View>

      <View style={styles.contentArea}>
        {loading ? (
          <LoadingEventDetails />
        ) : error ? (
          <ErrorEventDetails handleRetry={handleRetry} error={error} />
        ) : !event ? (
          <NoEventDetailsAvailable />
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.eventContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <EventDetailsHeader
                event={event}
                isSaved={isSaved}
                savingState={savingState}
                handleToggleSave={handleToggleSave}
                handleOpenMaps={handleOpenMaps}
                handleGetDirections={handleGetDirections}
                userLocation={userLocation}
              />

              {saveCount > 0 && <SaveCount saveCount={saveCount} />}


              {isAdmin && <AdminOriginalImageViewer eventId={event.id!} isAdmin={isAdmin} />}
            </ScrollView>

            <ShareEvent handleShare={handleShare} />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default EventDetails;
