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

  // Debug information display toggle

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
            ? `Connecting to job #${jobId}...`
            : isComplete
            ? "Processing Complete!"
            : `Processing job #${jobId}`
        }
        progressSteps={progressSteps}
        currentStep={currentStep}
        isComplete={isComplete && !error}
        hasError={!!error}
        errorMessage={error || undefined}
      />

      {/* Connection status indicator (subtle, not taking over the entire screen) */}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
  },
  connectionText: {
    color: "#4dabf7",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  resetButton: {
    backgroundColor: "#4dabf7",
    padding: 16,
    borderRadius: 8,
    margin: 24,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
});
