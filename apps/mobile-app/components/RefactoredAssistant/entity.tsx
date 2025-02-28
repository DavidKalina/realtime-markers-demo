// styles/entity.ts
import { StyleSheet } from "react-native";

export const entity = StyleSheet.create({
  entityWrapper: {
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  entityContainer: {
    width: 48,
    height: 48,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
