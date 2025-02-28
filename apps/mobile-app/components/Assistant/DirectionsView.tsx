import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MapPin, Navigation, X } from "lucide-react-native";
import { styles } from "./styles";
import { EventType } from "./types";

interface DirectionsViewProps {
  event: EventType;
  onClose: () => void;
}

export const DirectionsView: React.FC<DirectionsViewProps> = ({ event, onClose }) => {
  const transportOptions = [
    { id: "walking", name: "Walking", time: "25 min", icon: "🚶" },
    { id: "driving", name: "Driving", time: "8 min", icon: "🚗" },
    { id: "transit", name: "Transit", time: "15 min", icon: "🚆" },
    { id: "cycling", name: "Cycling", time: "12 min", icon: "🚲" },
  ];

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayHeader}>
        <Text style={styles.overlayTitle}>Directions to Event</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={16} color="#fcd34d" />
        </TouchableOpacity>
      </View>

      <View style={styles.destinationCard}>
        <MapPin size={16} color="#fcd34d" style={styles.icon} />
        <Text style={styles.destinationText}>{event.location}</Text>
        <Text style={styles.distanceText}>{event.distance}</Text>
      </View>

      <Text style={styles.sectionTitle}>Transport Options</Text>

      {transportOptions.map((option) => (
        <TouchableOpacity key={option.id} style={styles.transportOption}>
          <Text style={styles.transportEmoji}>{option.icon}</Text>
          <View style={styles.transportDetails}>
            <Text style={styles.transportName}>{option.name}</Text>
            <Text style={styles.transportTime}>{option.time}</Text>
          </View>
          <Navigation size={16} color="#fcd34d" />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.startNavigationButton}>
        <Text style={styles.startNavigationText}>Start Navigation</Text>
      </TouchableOpacity>
    </View>
  );
};
