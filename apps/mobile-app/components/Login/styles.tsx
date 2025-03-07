import { StyleSheet, Dimensions } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent", // Changed from #222 to transparent to show background
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
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "SpaceMono-Regular",
  },
  errorContainer: {
    backgroundColor: "rgba(255, 70, 70, 0.2)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 70, 70, 0.3)",
  },
  errorText: {
    color: "#ff4646",
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: "#444",
    zIndex: 3, // Ensure inputs are above background
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#fff",
    fontSize: 16,
    fontFamily: "SpaceMono-Regular",
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: "#4dabf7",
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
    color: "#333",
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
    color: "#ccc",
    fontSize: 14,
    fontFamily: "SpaceMono-Regular",
  },
  createAccountLink: {
    color: "#4dabf7",
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
    color: "#aaa",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: "SpaceMono-Regular",
  },

  // Dropdown styles
  profileSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#333",
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#444",
    height: 55,
    zIndex: 4, // Higher zIndex for dropdown
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
    color: "#fff",
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
    color: "#bbb",
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 10, // Modal should be on top of everything
  },
  dropdownContainer: {
    width: "90%",
    maxWidth: 400,
    maxHeight: 300,
    backgroundColor: "#333",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#444",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
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
    borderBottomColor: "#444",
  },
  profileEmojiSmall: {
    fontSize: 24,
    marginRight: 12,
  },
  profileDropdownName: {
    color: "#fff",
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
