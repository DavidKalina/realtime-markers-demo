import EventDetails from "@/components/EventDetails/EventDetails";
import { useLocalSearchParams } from "expo-router";
import React from "react";

const DetailScreen = () => {
  const { eventId } = useLocalSearchParams();

  return <EventDetails eventId={eventId.toString()} />;
};

export default DetailScreen;
