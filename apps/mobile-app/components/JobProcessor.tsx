import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useJobStream } from "../hooks/useJobStream";
import { DynamicProcessingView } from "./ProcessingView";

interface JobProcessorProps {
  jobId: string | null;
  onComplete?: (result: any) => void;
  onReset?: () => void;
}

export const JobProcessor: React.FC<JobProcessorProps> = ({ jobId, onComplete, onReset }) => {
  const [showDebug, setShowDebug] = useState(false);

  const {
    jobState,
    progressSteps,
    currentStep,
    isConnected,
    error,
    isComplete,
    resetStream,
    result,
    lastReceivedMessage,
    seenSteps,
  } = useJobStream(jobId);

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
      <DynamicProcessingView
        text={isComplete ? "Processing Complete!" : `Processing job #${jobId}`}
        progressSteps={progressSteps}
        currentStep={currentStep}
        isComplete={isComplete && !error}
        hasError={!!error}
        errorMessage={error || undefined}
      />

      <TouchableOpacity style={styles.debugButton} onPress={() => setShowDebug(!showDebug)}>
        <Text style={styles.debugButtonText}>
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </Text>
      </TouchableOpacity>

      {showDebug && (
        <ScrollView style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Job Status</Text>
          <Text style={styles.debugText}>
            Job ID: {jobId}
            {"\n"}
            Current Step: {currentStep} ({progressSteps[currentStep]}){"\n"}
            Is Complete: {isComplete ? "Yes" : "No"}
            {"\n"}
            Has Error: {error ? "Yes" : "No"}
          </Text>

          <Text style={styles.debugTitle}>Steps Seen</Text>
          {seenSteps.length > 0 ? (
            seenSteps.map((step, index) => (
              <Text key={index} style={styles.stepText}>
                • {step}
              </Text>
            ))
          ) : (
            <Text style={styles.stepText}>No steps recorded yet</Text>
          )}

          <Text style={styles.debugTitle}>Last Received Message</Text>
          <Text style={styles.messageText}>{lastReceivedMessage || "None"}</Text>

          {jobState && (
            <>
              <Text style={styles.debugTitle}>Job State</Text>
              <Text style={styles.jsonText}>{JSON.stringify(jobState, null, 2)}</Text>
            </>
          )}
        </ScrollView>
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
  debugButton: {
    backgroundColor: "#364fc7",
    padding: 8,
    borderRadius: 8,
    margin: 8,
    alignItems: "center",
  },
  debugButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  debugPanel: {
    backgroundColor: "#1a1a1a",
    margin: 8,
    padding: 12,
    borderRadius: 8,
    maxHeight: 300,
  },
  debugTitle: {
    color: "#ffa94d",
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 5,
    fontFamily: "SpaceMono",
  },
  debugText: {
    color: "#eee",
    fontSize: 12,
    fontFamily: "monospace",
  },
  stepText: {
    color: "#74c0fc",
    fontSize: 12,
    fontFamily: "monospace",
    marginLeft: 10,
  },
  messageText: {
    color: "#b2f2bb",
    fontSize: 11,
    fontFamily: "monospace",
    marginLeft: 5,
    marginRight: 5,
  },
  jsonText: {
    color: "#eee",
    fontSize: 11,
    fontFamily: "monospace",
    backgroundColor: "#2a2a2a",
    padding: 8,
    borderRadius: 4,
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
