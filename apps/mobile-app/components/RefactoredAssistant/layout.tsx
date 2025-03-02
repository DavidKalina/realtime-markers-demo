// styles/layout.ts
import { StyleSheet } from "react-native";

export const layout = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    position: "absolute",
    bottom: 40, // Add bottom margin
    margin: "auto",
    width: "95%", // Slightly narrower for better proportions
    alignSelf: "center",
    zIndex: 10000000, // Lower than fullscreen views
  },
  card: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 16,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
    flexDirection: "column",
    height: 150,
    borderWidth: 1,
    borderColor: "#3a3a3a", // Subtle border like event details
  },
  row: {
    flexDirection: "row",
    flex: 1,
    padding: 8,
    gap: 4,
  },
  textWrapper: {
    flex: 1,
  },
  fixedActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    flex: 1,
  },
  scrollViewContainer: {
    flex: 1,
    height: 50,
  },
  scrollableActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 4,
  },
});
