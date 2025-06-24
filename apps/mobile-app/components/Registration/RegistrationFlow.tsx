import React from "react";
import { View, StyleSheet } from "react-native";
import {
  RegistrationProvider,
  useRegistration,
} from "@/contexts/RegistrationContext";
import RegistrationStep1 from "./RegistrationStep1";
import RegistrationStep2 from "./RegistrationStep2";
import RegistrationStep3 from "./RegistrationStep3";
import RegistrationStep4 from "./RegistrationStep4";

const RegistrationFlow: React.FC = () => {
  return (
    <RegistrationProvider>
      <RegistrationFlowContent />
    </RegistrationProvider>
  );
};

const RegistrationFlowContent: React.FC = () => {
  const { currentStep } = useRegistration();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <RegistrationStep1 />;
      case 2:
        return <RegistrationStep2 />;
      case 3:
        return <RegistrationStep3 />;
      case 4:
        return <RegistrationStep4 />;
      default:
        return <RegistrationStep1 />;
    }
  };

  return <View style={styles.container}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default RegistrationFlow;
