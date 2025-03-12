import { AuthWrapper } from "@/components/AuthWrapper";
import ClusterEventsView from "@/components/ClusterEventsView/ClusterEventsView";
import React from "react";

const ClusterEventsScreen = () => {
  return (
    <AuthWrapper>
      <ClusterEventsView />
    </AuthWrapper>
  );
};

export default ClusterEventsScreen;
