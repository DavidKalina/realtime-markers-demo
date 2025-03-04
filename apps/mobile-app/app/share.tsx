import ShareEvent from "@/components/ShareEvent/ShareEvent";
import { useLocalSearchParams } from "expo-router";
import React from "react";

const ShareScreen = () => {
  const { eventId } = useLocalSearchParams();

  return <ShareEvent eventId={eventId.toString()} />;
};

export default ShareScreen;
