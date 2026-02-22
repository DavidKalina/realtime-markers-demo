// styles/entity.ts
import { StyleSheet } from "react-native";
import { colors, spacing } from "@/theme";

export const entity = StyleSheet.create({
  entityWrapper: {
    marginRight: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  entityContainer: {
    width: spacing["5xl"],
    height: spacing["5xl"],
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    // Shadow for depth
    shadowColor: colors.fixed.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});
