import { AuthWrapper } from "@/components/AuthWrapper";
import FriendsView from "@/components/Friends/FriendsView";
import React from "react";

export default function FriendsScreen() {
  return (
    <AuthWrapper>
      <FriendsView />
    </AuthWrapper>
  );
}
