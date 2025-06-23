import { AuthWrapper } from "@/components/AuthWrapper";
import RegistrationFlow from "@/components/Registration/RegistrationFlow";
import React from "react";

const RegisterScreen: React.FC = () => {
  return (
    <AuthWrapper requireAuth={false}>
      <RegistrationFlow />
    </AuthWrapper>
  );
};

export default RegisterScreen;
