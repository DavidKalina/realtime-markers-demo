import { AuthWrapper } from "@/components/AuthWrapper";
import UserProfile from "@/components/UserProfile/UserProfile";
import React from "react";

const UserScreen = () => {
  return (
    <AuthWrapper>
      <UserProfile />
    </AuthWrapper>
  );
};

export default UserScreen;
