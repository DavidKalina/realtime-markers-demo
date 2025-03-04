import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, Send } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useContacts } from "../../hooks/useContacts";
import { useEventSharing } from "../../hooks/useEventSharing";
import { useMapLinks } from "../../hooks/useMapLinks";
import apiClient from "../../services/ApiClient";
import { styles } from "./styles";

interface ShareEventScreenProps {
  eventId: string;
  onBack?: () => void;
  prefillMessage?: string;
}

const ShareEventScreen: React.FC<ShareEventScreenProps> = ({
  eventId,
  onBack,
  prefillMessage = `Check out this event I'm attending!`,
}) => {
  const [event, setEvent] = useState<any>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const router = useRouter();

  // Use our custom hooks
  const {
    filteredContacts,
    selectedContacts,
    loading: contactsLoading,
    loadingMore,
    error: contactsError,
    hasPermission,
    searchQuery,
    setSearchQuery,
    toggleContactSelection,
    requestPermissionAgain,
    loadMoreContacts,
    refreshContacts,
  } = useContacts();

  const { mapLinks, openMap } = useMapLinks(event?.location, event?.coordinates);

  const { sharingProgress, shareViaDirectSMS } = useEventSharing(
    event,
    selectedContacts,
    mapLinks,
    prefillMessage
  );

  // Loading state - true if either event or contacts are loading
  const loading = eventLoading || contactsLoading;

  // Error state - prioritize event error over contacts error
  const error = eventError || contactsError;

  // Fetch event details when eventId changes
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!eventId) return;

      setEventLoading(true);
      setEventError(null);

      try {
        const eventData = await apiClient.getEventById(eventId);
        if (isMounted) {
          setEvent(eventData);
        }
      } catch (err) {
        if (isMounted) {
          setEventError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          console.error("Error fetching event details:", err);
        }
      } finally {
        if (isMounted) {
          setEventLoading(false);
        }
      }
    };

    fetchEventDetails();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Render contact item (now for FlatList)
  const renderContactItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.contactItem, item.selected && styles.contactItemSelected]}
      onPress={() => toggleContactSelection(item.id)}
    >
      <View style={styles.contactAvatarPlaceholder}>
        <Text style={styles.contactInitial}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.phoneNumber && <Text style={styles.contactDetail}>{item.phoneNumber}</Text>}
      </View>
      <View style={styles.checkboxContainer}>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Extract key for FlatList
  const keyExtractor = (item: any) => item.id;

  // Render the loading footer for FlatList
  const renderListFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text style={styles.loadingFooterText}>Loading more contacts...</Text>
      </View>
    );
  };

  // Handle end reached for infinite scrolling
  const handleEndReached = () => {
    loadMoreContacts();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Event</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>
              {eventLoading ? "Loading event details..." : "Loading contacts..."}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {contactsError && !hasPermission ? (
              <TouchableOpacity style={styles.retryButton} onPress={requestPermissionAgain}>
                <Text style={styles.retryButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  if (eventError) {
                    setEventError(null);
                    setEventLoading(true);
                    // This will trigger the useEffect to fetch event again
                  }
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : sharingProgress.inProgress ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.progressText}>
              Sending messages ({sharingProgress.current} of {sharingProgress.total})...
            </Text>
          </View>
        ) : !event ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No event details available</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.shareContainer}>
            {/* Search Container */}
            <View style={styles.contactSelectContainer}>
              <Text style={styles.sectionLabel}>
                Select Contacts ({selectedContacts.length} selected)
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="#adb5bd"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Contacts List with FlatList */}
              <View style={styles.contactsListContainer}>
                {filteredContacts.length === 0 && !contactsLoading ? (
                  <Text style={styles.noContactsText}>No contacts found</Text>
                ) : (
                  <FlatList
                    data={filteredContacts}
                    renderItem={renderContactItem}
                    keyExtractor={keyExtractor}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderListFooter}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={true}
                    refreshControl={
                      <RefreshControl
                        refreshing={contactsLoading && !loadingMore}
                        onRefresh={refreshContacts}
                        colors={["#93c5fd"]}
                        tintColor="#93c5fd"
                      />
                    }
                    contentContainerStyle={styles.flatListContent}
                  />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.smsButton,
                selectedContacts.filter((c) => c.phoneNumber).length === 0 &&
                  styles.actionButtonDisabled,
              ]}
              onPress={shareViaDirectSMS}
              disabled={selectedContacts.filter((c) => c.phoneNumber).length === 0}
            >
              <Send size={20} color="#333" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>
                Send SMS ({selectedContacts.filter((c) => c.phoneNumber).length})
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default ShareEventScreen;
