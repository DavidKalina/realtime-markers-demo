import { useJobStreamEnhanced } from "@/hooks/useJobStream";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ImprovedProcessingView } from "./ProcessingView";

interface JobProcessorProps {
  jobId: string | null;
  onComplete?: (result: any) => void;
  onReset?: () => void;
}

export const EnhancedJobProcessor: React.FC<JobProcessorProps> = ({
  jobId,
  onComplete,
  onReset,
}) => {
  const { progressSteps, currentStep, isConnected, error, isComplete, resetStream, result } =
    useJobStreamEnhanced(jobId);

  // Fire onComplete callback when job is finished successfully
  React.useEffect(() => {
    if (isComplete && !error && result && onComplete) {
      onComplete(result);
    }
  }, [isComplete, error, result, onComplete]);

  if (!jobId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ImprovedProcessingView
        text={
          !isConnected && !isComplete
            ? `Connecting...`
            : isComplete
            ? "Processing Complete!"
            : `Processing document`
        }
        progressSteps={progressSteps}
        currentStep={currentStep}
        isComplete={isComplete && !error}
        hasError={!!error}
        errorMessage={error || undefined}
      />

      {!isConnected && !isComplete && (
        <View style={styles.connectionIndicator}>
          <Text style={styles.connectionText}>Establishing connection...</Text>
        </View>
      )}

      {(isComplete || error) && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            resetStream();
            if (onReset) onReset();
          }}
        >
          <Text style={styles.resetButtonText}>Start a New Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  connectionIndicator: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    padding: 4,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    alignItems: "center",
  },
  connectionText: {
    color: "#4dabf7",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  resetButton: {
    backgroundColor: "#4dabf7",
    padding: 14,
    borderRadius: 8,
    margin: 24,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontWeight: "500",
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
});
