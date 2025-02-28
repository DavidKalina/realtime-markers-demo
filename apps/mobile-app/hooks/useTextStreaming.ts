// hooks/useTextStreaming.ts
import * as Haptics from "expo-haptics";
import { useState } from "react";

export const useTextStreaming = () => {
  const [currentStreamedText, setCurrentStreamedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const simulateTextStreaming = async (text: string) => {
    setIsTyping(true);
    setCurrentStreamedText("");

    // Fix for text reversal bug: Add text character by character in correct order
    let currentText = "";
    for (let i = 0; i < text.length; i++) {
      // Trigger a subtle haptic every 3 characters
      if (i % 3 === 0) {
        Haptics.selectionAsync();
      }

      // Add next character to the current text
      currentText += text[i];

      // Important: Create a new string to ensure React detects the state change
      setCurrentStreamedText(currentText);

      // Wait before adding the next character
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setIsTyping(false);
  };

  return {
    currentStreamedText,
    isTyping,
    simulateTextStreaming,
  };
};
