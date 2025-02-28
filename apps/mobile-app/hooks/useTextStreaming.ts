// hooks/useTextStreaming.ts
import * as Haptics from "expo-haptics";
import { useState } from "react";

export const useTextStreaming = () => {
  const [currentStreamedText, setCurrentStreamedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const simulateTextStreaming = async (text: string) => {
    setIsTyping(true);
    setCurrentStreamedText("");

    for (let i = 0; i < text.length; i++) {
      // Trigger a subtle haptic every 3 characters
      if (i % 3 === 0) {
        Haptics.selectionAsync();
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
      setCurrentStreamedText((prev) => prev + text[i]);
    }

    setIsTyping(false);
  };

  return {
    currentStreamedText,
    isTyping,
    simulateTextStreaming,
  };
};
