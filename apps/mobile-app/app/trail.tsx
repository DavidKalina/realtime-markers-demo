import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import TrailDetails from "@/components/TrailDetails/TrailDetails";
import type { TrailData } from "@/components/TrailDetails/TrailDetails";
import { apiClient } from "@/services/ApiClient";
import { useColors } from "@/theme";

const TrailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const [trail, setTrail] = useState<TrailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    apiClient.areaScan
      .fetchTrailDetail(Number(id))
      .then((data) => {
        setTrail(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg.primary }}>
        <ActivityIndicator color={colors.accent.primary} />
      </View>
    );
  }

  if (!trail) return null;

  return <TrailDetails trail={trail} onBack={handleBack} />;
};

export default TrailScreen;
