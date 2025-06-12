import { AuthWrapper } from "@/components/AuthWrapper";
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

  return (
    <AuthWrapper>
      <ClusterEventsView events={events} isLoading={false} error={null} />
    </AuthWrapper>
  );
};

export default ClusterEventsScreen;
