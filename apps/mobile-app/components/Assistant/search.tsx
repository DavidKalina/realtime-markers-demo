// styles/search.ts
import { StyleSheet, Platform } from "react-native";

export const search = StyleSheet.create({
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#4a4a4a",
  },
  searchInput: {
    flex: 1,
    color: "#f8f9fa",
    fontSize: 16,
    fontFamily: "SpaceMono",
    padding: 0,
    marginRight: 8,
  },
  filtersContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#4a4a4a",
  },
  activeFilterChip: {
    backgroundColor: "#4dabf7",
    borderColor: "#4dabf7",
  },
  filterChipText: {
    color: "#f8f9fa",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  activeFilterChipText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  resultsText: {
    color: "#adb5bd",
    fontSize: 14,
    fontFamily: "SpaceMono",
    marginBottom: 16,
  },
  searchResultsContainer: {
    flex: 1,
    // Make sure this container takes all available space
    height: Platform.OS === "ios" ? undefined : "100%",
    maxHeight: 200,
  },
  searchResultsList: {
    paddingBottom: 16,
    // Only grow to content size, don't add extra space
    flexGrow: 0,
  },
  searchResultItem: {
    flexDirection: "row",
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4a4a4a",
  },
  resultEmoji: {
    fontSize: 24,
    marginRight: 12,
    alignSelf: "center",
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    color: "#f8f9fa",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  resultDetailText: {
    color: "#adb5bd",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  resultCategoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  resultCategoryChip: {
    backgroundColor: "#4a4a4a",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  resultCategoryText: {
    color: "#f8f9fa",
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  noResultsText: {
    color: "#adb5bd",
    fontSize: 16,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginBottom: 16,
  },
});
