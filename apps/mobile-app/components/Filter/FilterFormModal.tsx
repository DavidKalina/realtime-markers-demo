import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Keyboard,
  StyleSheet,
} from "react-native";
import { X, Save } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Layout,
} from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
};

interface FilterFormModalProps {
  visible: boolean;
  editingFilter: any;
  filterName: string;
  semanticQuery: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  radius?: number;
  isLocationEnabled: boolean;
  onClose: () => void;
  onSave: () => void;
  onDismissKeyboard: () => void;
  setFilterName: (value: string) => void;
  setSemanticQuery: (value: string) => void;
  setIsActive: (value: boolean) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setRadius: (value: number | undefined) => void;
  setIsLocationEnabled: (value: boolean) => void;
  setLocation: (value: { latitude: number; longitude: number } | null) => void;
  isMounted: React.RefObject<boolean>;
  cleanupModalAnimations: () => void;
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  modalScrollContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontFamily: "SpaceMono",
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "SpaceMono",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontFamily: "SpaceMono",
    fontStyle: "italic",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  dateRangeSeparator: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  radiusInput: {
    marginTop: 12,
  },
  locationButton: {
    marginTop: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  locationButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
});

export const FilterFormModal = React.memo<FilterFormModalProps>(
  ({
    visible,
    editingFilter,
    filterName,
    semanticQuery,
    isActive,
    startDate,
    endDate,
    radius,
    isLocationEnabled,
    onClose,
    onSave,
    onDismissKeyboard,
    setFilterName,
    setSemanticQuery,
    setIsActive,
    setStartDate,
    setEndDate,
    setRadius,
    setIsLocationEnabled,
    setLocation,
    isMounted,
    cleanupModalAnimations,
  }) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
      setIsSaving(true);
      try {
        await onSave();
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <Modal
        animationType="none"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        onDismiss={cleanupModalAnimations}
      >
        <Animated.View
          style={[styles.modalContainer]}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          onLayout={() => {
            if (!isMounted.current) {
              cleanupModalAnimations();
            }
          }}
        >
          <Animated.View
            style={[styles.modalContent]}
            entering={SlideInDown.springify()
              .damping(12)
              .stiffness(100)
              .withInitialValues({
                transform: [{ translateY: 50 }, { scale: 0.9 }],
              })}
            exiting={SlideOutDown.duration(150).withCallback((finished) => {
              "worklet";
              if (finished) {
                cleanupModalAnimations();
              }
            })}
            layout={Layout.springify().damping(12).stiffness(100)}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFilter ? "Edit Smart Filter" : "Create Smart Filter"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={20} color="#f8f9fa" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="on-drag"
            >
              {/* Filter Name - Most important, goes first */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Filter Name</Text>
                <TextInput
                  style={styles.input}
                  value={filterName}
                  onChangeText={setFilterName}
                  placeholder="Enter filter name"
                  placeholderTextColor="#adb5bd"
                  returnKeyType="next"
                />
              </View>

              {/* Active Toggle - Quick setting */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Active</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: "#3a3a3a", true: "#93c5fd" }}
                    thumbColor={isActive ? "#f8f9fa" : "#f8f9fa"}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Search Query</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={semanticQuery}
                  onChangeText={setSemanticQuery}
                  placeholder="Enter your search query in natural language"
                  placeholderTextColor="#adb5bd"
                  multiline
                  numberOfLines={3}
                />
                <Text style={styles.helperText}>
                  Example: "Events about AI and machine learning in the last
                  month"
                </Text>
              </View>

              {/* Date Range - Optional filter */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date Range</Text>
                <View style={styles.dateContainer}>
                  <TextInput
                    style={[styles.input, styles.dateInput]}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="Start (YYYY-MM-DD)"
                    placeholderTextColor="#adb5bd"
                  />
                  <Text style={styles.dateRangeSeparator}>to</Text>
                  <TextInput
                    style={[styles.input, styles.dateInput]}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="End (YYYY-MM-DD)"
                    placeholderTextColor="#adb5bd"
                  />
                </View>
              </View>

              {/* Location Settings - Optional filter */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.formLabel}>Location Filter</Text>
                  <Switch
                    value={isLocationEnabled}
                    onValueChange={setIsLocationEnabled}
                    trackColor={{ false: "#3a3a3a", true: "#93c5fd" }}
                    thumbColor={isLocationEnabled ? "#f8f9fa" : "#f8f9fa"}
                  />
                </View>
                {isLocationEnabled && (
                  <>
                    <TextInput
                      style={[styles.input, styles.radiusInput]}
                      value={radius?.toString() || ""}
                      onChangeText={(value) =>
                        setRadius(value ? parseFloat(value) : undefined)
                      }
                      placeholder="Radius in kilometers"
                      placeholderTextColor="#adb5bd"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.locationButton}
                      onPress={async () => {
                        try {
                          const { status } =
                            await Location.requestForegroundPermissionsAsync();
                          if (status !== "granted") {
                            Alert.alert(
                              "Permission Denied",
                              "Please enable location services to use this feature.",
                            );
                            return;
                          }

                          const location =
                            await Location.getCurrentPositionAsync({});
                          setLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                          });
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success,
                          );
                        } catch (err) {
                          console.error("Error getting location:", err);
                          Alert.alert(
                            "Error",
                            "Failed to get current location",
                          );
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.locationButtonText}>
                        Use Current Location
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <Save size={18} color="#f8f9fa" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>
                  {isSaving ? "Saving..." : "Save Filter"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  },
);
