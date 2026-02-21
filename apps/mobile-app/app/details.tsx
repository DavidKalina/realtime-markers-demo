import EventDetails from "@/components/EventDetails/EventDetails";
import { useLocalSearchParams } from "expo-router";
import React from "react";

const DetailScreen = () => {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  if (!eventId) return null;

  return <EventDetails eventId={eventId} />;
};

export default DetailScreen;
