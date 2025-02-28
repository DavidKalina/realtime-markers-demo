import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Share2, Copy, X, MessageSquare, Mail, Link } from "lucide-react-native";
import { styles } from "./styles";
import { EventType } from "./types";

interface ShareViewProps {
  event: EventType;
  onClose: () => void;
}

export const ShareView: React.FC<ShareViewProps> = ({ event, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    { id: "message", name: "Messages", icon: <MessageSquare size={20} color="#fcd34d" /> },
    { id: "email", name: "Email", icon: <Mail size={20} color="#fcd34d" /> },
    { id: "copy", name: "Copy Link", icon: <Copy size={20} color="#fcd34d" /> },
    { id: "more", name: "More Options", icon: <Link size={20} color="#fcd34d" /> },
  ];

  const shareText = `Check out this event: ${event.title} at ${event.location} on ${event.time}. ${event.description}`;

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayHeader}>
        <Text style={styles.overlayTitle}>Share Event</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={16} color="#fcd34d" />
        </TouchableOpacity>
      </View>

      <View style={styles.sharePreview}>
        <Text style={styles.shareEventTitle}>{event.title}</Text>
        <Text style={styles.shareEventDetails}>
          {event.location} • {event.time}
        </Text>
      </View>

      <View style={styles.shareTextContainer}>
        <TextInput style={styles.shareTextInput} multiline value={shareText} editable={true} />
      </View>

      <Text style={styles.shareViaText}>Share via:</Text>

      <View style={styles.shareOptionsGrid}>
        {shareOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.shareOption}
            onPress={() => option.id === "copy" && handleCopy()}
          >
            <View style={styles.shareOptionIconContainer}>{option.icon}</View>
            <Text style={styles.shareOptionText}>{option.name}</Text>
            {option.id === "copy" && copied && <Text style={styles.copiedText}>Copied!</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.shareButton}>
        <Share2 size={16} color="#fff" style={styles.shareButtonIcon} />
        <Text style={styles.shareButtonText}>Share Now</Text>
      </TouchableOpacity>
    </View>
  );
};
