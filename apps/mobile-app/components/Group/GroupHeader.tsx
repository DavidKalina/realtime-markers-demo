import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import Banner from "@/components/Layout/Banner";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { SharedValue } from "react-native-reanimated";

interface GroupHeaderProps {
  emoji: string;
  name: string;
  description?: string;
  onBack: () => void;
  scrollY: SharedValue<number>;
}

export const GroupHeader: React.FC<GroupHeaderProps> = ({
  emoji,
  name,
  description = "",
  onBack,
  scrollY,
}) => {
  return (
    <>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <ArrowLeft size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Banner
        emoji={emoji}
        name={name}
        description={description}
        onBack={onBack}
        scrollY={scrollY}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
});
