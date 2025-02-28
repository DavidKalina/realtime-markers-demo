import { StyleSheet } from "react-native";

// Define the style object type to help TypeScript recognize all properties

export const styles = StyleSheet.create({
  innerContainer: {
    marginTop: 600,
    width: "95%",
    margin: "auto",
  },
  card: {
    backgroundColor: "#4b5563", // steel blue
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
    flexDirection: "column",
    height: 150, // increased height to accommodate the taller action bar
  },
  row: {
    flexDirection: "row",
    flex: 1,
    padding: 8,
  },
  emojiWrapper: {
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiContainer: {
    width: 56,
    height: 56,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "#1f2937", // charcoal
    borderWidth: 1,
    borderColor: "#374151", // gray-700
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 32,
    zIndex: 10,
    color: "#ffffff",
  },
  emojiOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "rgba(75,85,99,0.5)",
  },
  textWrapper: {
    flex: 1,
  },
  messageBubble: {
    backgroundColor: "#1f2937", // charcoal
    borderRadius: 8,
    padding: 8,
    flex: 1, // fills the remaining vertical space above the bottom bar
  },
  messageText: {
    color: "#cbd5e1", // steel blue light variant
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    minHeight: 48,
    fontFamily: "SpaceMono",
  },
  dots: {
    color: "#fcd34d",
    fontSize: 12,
  },
  progressDotsContainer: {
    flexDirection: "row",
    marginTop: 12,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  detailTitle: {
    color: "#93c5fd", // steel blue highlight
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  detailDescription: {
    color: "#cbd5e1", // steel blue light variant
    fontSize: 14,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  interactiveDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  detailActionIcon: {
    marginLeft: 8,
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
  },
  detailActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#374151",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  detailActionText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  detailText: {
    color: "#93c5fd", // steel blue highlight
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151", // gray-700
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  categoryText: {
    color: "#93c5fd", // steel blue highlight
    fontSize: 10,
    fontFamily: "SpaceMono",
  },
  actionButtonText: {
    fontFamily: "SpaceMono",
    color: "#cbd5e1", // steel blue light variant
    fontSize: 12,
    fontWeight: "500",
  },
  detailButtonText: {
    fontFamily: "SpaceMono",
    color: "#cbd5e1", // steel blue light variant
    fontSize: 14,
    fontWeight: "500",
  },
  // Bottom bar integrated into the card
  bottomBar: {
    height: 50,
    backgroundColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  labeledActionButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  activeActionButton: {
    backgroundColor: "rgba(75, 85, 99, 0.8)",
  },
  actionButtonLabel: {
    color: "#fcd34d",
    fontSize: 10,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  scrollableActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    height: 50,
  },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  icon: {
    marginRight: 4,
  },
  iconSmall: {
    marginRight: 2,
  },
});
