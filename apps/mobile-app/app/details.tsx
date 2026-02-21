import { AuthWrapper } from "@/components/AuthWrapper";
import EventDetails from "@/components/EventDetails/EventDetails";
import { useLocalSearchParams } from "expo-router";
import React from "react";

const DetailScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  if (!eventId) return null;

  return (
    <AuthWrapper>
      <EventDetails eventId={eventId} />
    </AuthWrapper>
  );
};

export default DetailScreen;
