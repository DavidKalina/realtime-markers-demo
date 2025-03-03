// components/AssistantActions.tsx
import React from "react";
import Animated from "react-native-reanimated";
import { ActionBar } from "../ActionBar/ActionBar";

interface AssistantActionsProps {
  onActionPress: (action: string) => void;
  isStandalone: boolean;
  animatedStyle: any;
}

/**
 * Wrapper for the action bar with animation support
 */
const AssistantActions: React.FC<AssistantActionsProps> = ({
  onActionPress,
  isStandalone,
  animatedStyle,
}) => {
  // ActionBar already has the structure needed, we're just adding animation support
  return (
    <ActionBar
      onActionPress={onActionPress}
      isStandalone={isStandalone}
      animatedStyle={animatedStyle}
    />
  );
};

export default AssistantActions;
