import { Bug, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface WebSocketDebuggerProps {
  wsUrl: string;
  isConnected: boolean;
  markers: any[];
}

const WebSocketDebugger: React.FC<WebSocketDebuggerProps> = ({ wsUrl, isConnected, markers }) => {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Add a log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Collect connection info on mount and when props change
  useEffect(() => {
    if (visible) {
      addLog(`WebSocket URL: ${wsUrl}`);
      addLog(`Connection status: ${isConnected ? "Connected" : "Disconnected"}`);
      addLog(`Markers received: ${markers.length}`);

      if (markers.length > 0) {
        addLog(`Sample marker: ${JSON.stringify(markers[0], null, 2)}`);
      }
    }
  }, [visible, isConnected, markers.length, wsUrl]);

  // Debug button to toggle modal
  return (
    <>
      <TouchableOpacity style={styles.debugButton} onPress={() => setVisible(true)}>
        <Bug size={20} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>WebSocket Debugger</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  isConnected ? styles.connected : styles.disconnected,
                ]}
              />
              <Text style={styles.statusText}>{isConnected ? "Connected" : "Disconnected"}</Text>
            </View>

            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>URL: {wsUrl}</Text>
              <Text style={styles.statsText}>Markers: {markers.length}</Text>
            </View>

            <View style={styles.logsContainer}>
              <View style={styles.logsHeader}>
                <Text style={styles.logsTitle}>Logs</Text>
                <TouchableOpacity onPress={clearLogs}>
                  <Text style={styles.clearButton}>Clear</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.logsScroll}>
                {logs.map((log, index) => (
                  <Text key={index} style={styles.logText}>
                    {log}
                  </Text>
                ))}
                {logs.length === 0 && <Text style={styles.emptyLog}>No logs yet...</Text>}
              </ScrollView>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  addLog("Manual log added by user");
                }}
              >
                <Text style={styles.actionButtonText}>Add Log</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  addLog("Debug: Inspecting markers...");
                  if (markers.length > 0) {
                    markers.forEach((marker, idx) => {
                      if (idx < 3) {
                        // Show only first 3 markers to avoid flooding
                        addLog(`Marker ${idx}: ${JSON.stringify(marker, null, 2)}`);
                      }
                    });
                    if (markers.length > 3) {
                      addLog(`...and ${markers.length - 3} more markers`);
                    }
                  } else {
                    addLog("No markers available");
                  }
                }}
              >
                <Text style={styles.actionButtonText}>Inspect Markers</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  debugButton: {
    position: "absolute",
    bottom: 200, // Position above the assistant
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(50, 50, 50, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
  },
  closeButton: {
    padding: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connected: {
    backgroundColor: "#4caf50",
  },
  disconnected: {
    backgroundColor: "#f44336",
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  statsContainer: {
    backgroundColor: "#222",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsText: {
    color: "#e0e0e0",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  logsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logsTitle: {
    color: "#4dabf7",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
  },
  clearButton: {
    color: "#f44336",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  logsScroll: {
    flex: 1,
  },
  logText: {
    color: "#d0d0d0",
    fontSize: 11,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  emptyLog: {
    color: "#666",
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    marginTop: 20,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
});

export default WebSocketDebugger;
