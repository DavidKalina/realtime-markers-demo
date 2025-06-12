import { AuthWrapper } from "@/components/AuthWrapper";
import EventDetails from "@/components/EventDetails/EventDetails";
import { useLocalSearchParams } from "expo-router";
import React from "react";

const DetailScreen = () => {
  const { eventId } = useLocalSearchParams();

  return (
    <AuthWrapper>
      <EventDetails eventId={eventId.toString()} />
    </AuthWrapper>
  );
};

export default DetailScreen;
