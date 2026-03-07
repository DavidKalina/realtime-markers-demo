import React, { useMemo } from "react";
import { createStyles } from "./styles";
import { View, Text } from "react-native";
import { useColors } from "@/theme";

const SaveCount = ({ saveCount }: { saveCount: number }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.saveCountContainer}>
      <Text style={styles.saveCountText}>
        {saveCount} {saveCount === 1 ? "person" : "people"} saved this event
      </Text>
    </View>
  );
};

export default React.memo(SaveCount);
