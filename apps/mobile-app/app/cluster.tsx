import ClusterEventsView from "@/components/ClusterEventsView/ClusterEventsView";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { EventType } from "@/types/types";

const ClusterEventsScreen = () => {
  const { events: eventsParam } = useLocalSearchParams<{ events: string }>();

  // Parse the events from the query parameter
  const events: EventType[] = eventsParam
    ? JSON.parse(decodeURIComponent(eventsParam))
    : [];

  return <ClusterEventsView events={events} isLoading={false} error={null} />;
};

export default ClusterEventsScreen;
