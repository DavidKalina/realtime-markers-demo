import React, { useCallback, useRef } from "react";
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
} from "react-native";
import { X, Save } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Layout,
} from "react-native-reanimated";
import { styles } from "./styles";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

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

    const scrollToInput = useCallback((target: any) => {
      if (scrollViewRef.current && target) {
        target.measureLayout(
          scrollViewRef.current.getInnerViewNode(),
          (_: number, y: number) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          },
          () => {}
        );
      }
    }, []);

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
              .withInitialValues({ transform: [{ translateY: 50 }, { scale: 0.9 }] })}
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
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
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
                  onFocus={(e) => scrollToInput(e.target)}
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

              {/* Semantic Query - Core functionality */}
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
                  onFocus={(e) => scrollToInput(e.target)}
                />
                <Text style={styles.helperText}>
                  Example: "Events about AI and machine learning in the last month"
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
                    onFocus={(e) => scrollToInput(e.target)}
                  />
                  <Text style={styles.dateRangeSeparator}>to</Text>
                  <TextInput
                    style={[styles.input, styles.dateInput]}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="End (YYYY-MM-DD)"
                    placeholderTextColor="#adb5bd"
                    onFocus={(e) => scrollToInput(e.target)}
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
                      onChangeText={(value) => setRadius(value ? parseFloat(value) : undefined)}
                      placeholder="Radius in kilometers"
                      placeholderTextColor="#adb5bd"
                      keyboardType="numeric"
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                    <TouchableOpacity
                      style={styles.locationButton}
                      onPress={async () => {
                        try {
                          const { status } = await Location.requestForegroundPermissionsAsync();
                          if (status !== "granted") {
                            Alert.alert(
                              "Permission Denied",
                              "Please enable location services to use this feature."
                            );
                            return;
                          }

                          const location = await Location.getCurrentPositionAsync({});
                          setLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                          });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (err) {
                          console.error("Error getting location:", err);
                          Alert.alert("Error", "Failed to get current location");
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.locationButtonText}>Use Current Location</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={onSave} activeOpacity={0.7}>
                <Save size={18} color="#f8f9fa" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Save Filter</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }
);
