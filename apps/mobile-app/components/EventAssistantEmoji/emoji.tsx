// styles/emoji.ts
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  emojiWrapper: {
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiContainer: {
    width: 48,
    height: 48,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "#3a3a3a", // Match event details card background
    borderWidth: 1,
    borderColor: "#4a4a4a", // Match event details border
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 28,
    zIndex: 10,
    color: "#ffffff",
  },
  emojiOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "rgba(75,85,99,0.2)",
  },
  emoji: {
    fontSize: 24,
    marginRight: 10,
  },
});
