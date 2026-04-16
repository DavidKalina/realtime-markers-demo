import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/theme";
import { useUserLocation } from "@/contexts/LocationContext";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { apiClient } from "@/services/ApiClient";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import { SkiaGlow } from "@/components/SkiaGlow";
import { StepConceptPicker } from "@/components/Onboarding/StepConceptPicker";
import type { QuestConcept } from "@/services/api/modules/sidequests";

const ConceptPickerScreen: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const { userLocation } = useUserLocation();
  const { trackJob } = useJobProgressContext();

  const [concepts, setConcepts] = useState<QuestConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch pending concepts on mount
  useEffect(() => {
    (async () => {
      try {
        const { concepts: pending } = await apiClient.sidequests.getPendingConcepts();
        setConcepts(pending);
      } catch (err) {
        console.error("Failed to fetch pending concepts:", err);
      }
    })();
  }, []);

  const handleConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const selected = concepts.find((c) => c.id === selectedConceptId);
      if (!selected) return;

      const lat = userLocation ? userLocation[1] : 0;
      const lng = userLocation ? userLocation[0] : 0;
      const { jobId } = await apiClient.sidequests.prescribeQuest({
        latitude: lat,
        longitude: lng,
        timezone: getUserTimezone(),
        chosenConcept: {
          title: selected.title,
          experienceType: selected.experienceType,
          suggestedCategories: selected.suggestedCategories,
          targetCity: selected.targetCity,
          searchQueries: selected.searchQueries,
          difficulty: selected.difficulty,
        },
      });

      trackJob(jobId);

      // Navigate to dashboard — quest generation streams progress there
      router.replace("/");
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Concept confirm error:", err);
      setIsLoading(false);
    }
  }, [concepts, selectedConceptId, userLocation, trackJob, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={[s.container, { backgroundColor: colors.fixed.black }]}>
      <SkiaGlow />

      <SafeAreaView style={s.safeArea}>
        <StepConceptPicker
          concepts={concepts}
          selectedConceptId={selectedConceptId}
          onSelectConcept={setSelectedConceptId}
          onConfirm={handleConfirm}
          onBack={handleBack}
          isLoading={isLoading}
        />
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});

export default ConceptPickerScreen;
