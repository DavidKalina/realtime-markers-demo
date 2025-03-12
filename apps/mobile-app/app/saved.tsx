import { AuthWrapper } from "@/components/AuthWrapper";
import SavedEventsView from "@/components/SavedEvents/SavedEvents";
import React from "react";

const SavedScreen = () => {
  return (
    <AuthWrapper>
      <SavedEventsView />;
    </AuthWrapper>
  );
};

export default SavedScreen;
