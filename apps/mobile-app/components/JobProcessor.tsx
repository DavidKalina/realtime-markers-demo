import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ImprovedProcessingView } from "./ProcessingView";
import { useJobStreamEnhanced } from "@/hooks/useJobStream";

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
  const {
    progressSteps,
    currentStep,
    isConnected,
    error,
    isComplete,
    resetStream,
    result,
    debugInfo,
  } = useJobStreamEnhanced(jobId);

  // Debug information display toggle
  const [showDebug, setShowDebug] = useState(false);

  // Fire onComplete callback when job is finished successfully
  React.useEffect(() => {
    if (isComplete && !error && result && onComplete) {
      onComplete(result);
    }
  }, [isComplete, error, result, onComplete]);

  if (!jobId) {
    return null;
  }

  // Show connection status when not connected
  if (!isConnected && !isComplete) {
    return (
      <View style={styles.container}>
        <Text style={styles.connecting}>Connecting to job #{jobId}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImprovedProcessingView
        text={isComplete ? "Processing Complete!" : `Processing job #${jobId}`}
        progressSteps={progressSteps}
        currentStep={currentStep}
        isComplete={isComplete && !error}
        hasError={!!error}
        errorMessage={error || undefined}
      />

      {/* Debug info toggle */}
      <TouchableOpacity style={styles.debugToggle} onPress={() => setShowDebug(!showDebug)}>
        <Text style={styles.debugToggleText}>
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </Text>
      </TouchableOpacity>

      {/* Debug information */}
      {showDebug && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Information</Text>
          <Text style={styles.debugText}>Current Step: {currentStep}</Text>
          <Text style={styles.debugText}>Display Index: {debugInfo.displayIndex}</Text>
          <Text style={styles.debugText}>
            Step Sequence: {debugInfo.seenStepSequence.join(", ")}
          </Text>
          <Text style={styles.debugTitle}>All Updates:</Text>
          {debugInfo.allUpdates.map((update, i) => (
            <Text key={i} style={styles.debugUpdate}>
              • {update}
            </Text>
          ))}
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
  connecting: {
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
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
  debugToggle: {
    backgroundColor: "#555",
    padding: 8,
    borderRadius: 4,
    margin: 8,
    alignItems: "center",
  },
  debugToggleText: {
    color: "#ddd",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  debugContainer: {
    margin: 8,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  debugTitle: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  debugText: {
    color: "#ddd",
    fontSize: 12,
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  debugUpdate: {
    color: "#ddd",
    fontSize: 12,
    marginLeft: 8,
    fontFamily: "SpaceMono",
  },
});
