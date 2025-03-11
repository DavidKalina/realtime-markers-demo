import { StyleSheet, Dimensions } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent", // Remains transparent to show the background
  },
  headerContainer: {
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2, // Ensure header is above background
  },
  keyboardAvoidingView: {
    flex: 1,
    zIndex: 2, // Ensure content is above background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    marginTop: 20,
    zIndex: 2, // Ensure form is above background
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333", // Changed from white to dark
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "SpaceMono-Regular",
  },
  errorContainer: {
    backgroundColor: "rgba(255, 70, 70, 0.1)", // Lighter red background
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 70, 70, 0.3)",
  },
  errorText: {
    color: "#e53935", // Slightly darker red for better contrast
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff", // Changed from dark to white
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: "#ddd", // Lighter border
    zIndex: 3, // Ensure inputs are above background
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#333", // Changed from white to dark
    fontSize: 16,
    fontFamily: "SpaceMono-Regular",
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: "#4dabf7", // Keeping the blue accent color
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 3, // Ensure button is above background
  },
  loginButtonText: {
    color: "#fff", // Changed to white for better contrast on blue
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  createAccountContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
    zIndex: 3, // Ensure links are above background
  },
  createAccountText: {
    color: "#666", // Changed from light gray to darker gray
    fontSize: 14,
    fontFamily: "SpaceMono-Regular",
  },
  createAccountLink: {
    color: "#4dabf7", // Keeping the blue accent color
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  toggleManualButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    zIndex: 3, // Ensure button is above background
  },
  toggleManualText: {
    color: "#666", // Changed from light gray to darker gray
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: "SpaceMono-Regular",
  },

  // Dropdown styles
  profileSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff", // Changed from dark to white
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ddd", // Lighter border
    height: 55,
    zIndex: 4, // Higher zIndex for dropdown
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedProfileContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flex: 1,
    height: "100%",
  },
  profileInfoContainer: {
    justifyContent: "center",
    marginLeft: 8,
  },
  profileEmojiLarge: {
    fontSize: 28,
    marginRight: 2,
  },
  selectedProfileName: {
    color: "#333", // Changed from white to dark
    fontSize: 15,
    fontFamily: "SpaceMono-Regular",
    fontWeight: "500",
  },
  selectedProfileRole: {
    fontSize: 11,
    fontFamily: "SpaceMono-Bold",
    textTransform: "uppercase",
    marginTop: 2,
  },
  noProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  placeholderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 23,
    backgroundColor: "rgba(77, 171, 247, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(77, 171, 247, 0.3)",
  },
  selectProfileText: {
    color: "#666", // Changed from light gray to darker gray
    fontSize: 16,
    fontFamily: "SpaceMono-Regular",
  },
  dropdownTrigger: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(77, 171, 247, 0.15)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Slightly lighter overlay
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 10, // Modal should be on top of everything
  },
  dropdownContainer: {
    width: "90%",
    maxWidth: 400,
    maxHeight: 300,
    backgroundColor: "#fff", // Changed from dark to white
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd", // Lighter border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10, // Ensure dropdown is on top
  },
  profileList: {
    width: "100%",
    paddingVertical: 4,
  },
  profileDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee", // Lighter border
  },
  profileEmojiSmall: {
    fontSize: 24,
    marginRight: 12,
  },
  profileDropdownName: {
    color: "#333", // Changed from white to dark
    fontSize: 16,
    fontFamily: "SpaceMono-Regular",
    flex: 1,
  },
  profileDropdownRole: {
    fontSize: 12,
    fontFamily: "SpaceMono-Bold",
    textTransform: "uppercase",
  },
});
