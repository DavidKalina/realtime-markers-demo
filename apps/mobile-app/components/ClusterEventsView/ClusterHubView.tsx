import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, FlatList } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { ArrowLeft, Calendar, MapPin, Tag } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { EventType } from "@/types/types";
import EventDetailsHeader from "../EventDetails/EventDetailsHeader";

// Reuse the color theme from EventDetailsHeader
const COLORS = {
  background: "#2a2a2a",
  cardBackground: "#3a3a3a",
  textPrimary: "#f8f9fa",
  textSecondary: "#93c5fd",
  accent: "#93c5fd",
  divider: "rgba(147, 197, 253, 0.12)",
  buttonBackground: "rgba(147, 197, 253, 0.1)",
  buttonBorder: "rgba(147, 197, 253, 0.15)",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ClusterHubData {
  featuredEvent: EventType | null;
  eventsByCategory: {
    category: { id: string; name: string };
    events: EventType[];
  }[];
  eventsByLocation: {
    location: string;
    events: EventType[];
  }[];
  eventsToday: EventType[];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  featuredEventContainer: {
    padding: 16,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: COLORS.buttonBackground,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  activeTabText: {
    color: COLORS.textPrimary,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },
  eventList: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },
});

const TabButton = ({
  icon: Icon,
  label,
  isActive,
  onPress,
}: {
  icon: any;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[styles.tab, isActive && styles.activeTab]} onPress={onPress}>
    <Icon size={20} color={isActive ? COLORS.textPrimary : COLORS.textSecondary} />
    <Text style={[styles.tabText, isActive && styles.activeTabText]}>{label}</Text>
  </TouchableOpacity>
);

const EventCard = ({ event, onPress }: { event: EventType; onPress: () => void }) => (
  <TouchableOpacity style={styles.eventCard} onPress={onPress}>
    <Text style={styles.eventTitle}>{event.title}</Text>
    <View style={styles.eventDetails}>
      <Calendar size={16} color={COLORS.textSecondary} />
      <Text style={styles.eventDetailText}>{new Date(event.eventDate).toLocaleDateString()}</Text>
    </View>
    <View style={styles.eventDetails}>
      <MapPin size={16} color={COLORS.textSecondary} />
      <Text style={styles.eventDetailText}>{event.location}</Text>
    </View>
  </TouchableOpacity>
);

const ClusterHubView = ({ hubData }: { hubData: ClusterHubData }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"categories" | "locations" | "today">("categories");
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleTabPress = (tab: "categories" | "locations" | "today") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleEventPress = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/details?eventId=${event.id}` as never);
  };

  const renderCategorySection = ({
    item,
  }: {
    item: { category: { id: string; name: string }; events: EventType[] };
  }) => (
    <View style={{ width: SCREEN_WIDTH }}>
      <View style={styles.categoryHeader}>
        <Tag size={20} color={COLORS.textSecondary} />
        <Text style={styles.categoryTitle}>{item.category.name}</Text>
      </View>
      <FlatList
        data={item.events}
        renderItem={({ item: event }) => (
          <EventCard event={event} onPress={() => handleEventPress(event)} />
        )}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.eventList}
      />
    </View>
  );

  const renderLocationSection = ({ item }: { item: { location: string; events: EventType[] } }) => (
    <View style={{ width: SCREEN_WIDTH }}>
      <View style={styles.categoryHeader}>
        <MapPin size={20} color={COLORS.textSecondary} />
        <Text style={styles.categoryTitle}>{item.location}</Text>
      </View>
      <FlatList
        data={item.events}
        renderItem={({ item: event }) => (
          <EventCard event={event} onPress={() => handleEventPress(event)} />
        )}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.eventList}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cluster Hub</Text>
      </View>

      {hubData.featuredEvent && (
        <View style={styles.featuredEventContainer}>
          <EventDetailsHeader
            event={hubData.featuredEvent}
            isSaved={false}
            savingState="idle"
            handleToggleSave={() => {}}
            handleOpenMaps={() => {}}
            handleGetDirections={() => {}}
            userLocation={null}
          />
        </View>
      )}

      <View style={styles.tabContainer}>
        <TabButton
          icon={Tag}
          label="Categories"
          isActive={activeTab === "categories"}
          onPress={() => handleTabPress("categories")}
        />
        <TabButton
          icon={MapPin}
          label="Locations"
          isActive={activeTab === "locations"}
          onPress={() => handleTabPress("locations")}
        />
        <TabButton
          icon={Calendar}
          label="Today"
          isActive={activeTab === "today"}
          onPress={() => handleTabPress("today")}
        />
      </View>

      {activeTab === "categories" && (
        <FlatList
          ref={flatListRef}
          data={hubData.eventsByCategory}
          renderItem={renderCategorySection}
          keyExtractor={(item) => item.category.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            scrollX.value = event.nativeEvent.contentOffset.x;
          }}
        />
      )}

      {activeTab === "locations" && (
        <FlatList
          ref={flatListRef}
          data={hubData.eventsByLocation}
          renderItem={renderLocationSection}
          keyExtractor={(item) => item.location}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            scrollX.value = event.nativeEvent.contentOffset.x;
          }}
        />
      )}

      {activeTab === "today" && (
        <FlatList
          data={hubData.eventsToday}
          renderItem={({ item: event }) => (
            <EventCard event={event} onPress={() => handleEventPress(event)} />
          )}
          keyExtractor={(event) => event.id}
          contentContainerStyle={styles.eventList}
        />
      )}
    </View>
  );
};

export default ClusterHubView;
