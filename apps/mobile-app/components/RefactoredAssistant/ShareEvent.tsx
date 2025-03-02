import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import * as Contacts from "expo-contacts";
import * as Sharing from "expo-sharing";
import { styles } from "./styles";

interface ShareEventProps {
  eventId: string;
  eventDetails: any; // You can replace with a more specific type
  onClose: () => void;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  selected: boolean;
}

const ShareEvent: React.FC<ShareEventProps> = ({ eventId, eventDetails, onClose }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [customMessage, setCustomMessage] = useState("");

  // Request contacts permission and fetch contacts
  useEffect(() => {
    const getContacts = async () => {
      setLoading(true);

      try {
        const { status } = await Contacts.requestPermissionsAsync();

        if (status === "granted") {
          setHasPermission(true);
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
          });

          if (data.length > 0) {
            // Safe mapping function for contacts that ensures valid IDs
            const processedContacts: Contact[] = [];

            for (const contact of data) {
              // Skip contacts without an ID
              if (!contact.id) continue;

              const phoneNumber =
                contact.phoneNumbers && contact.phoneNumbers.length > 0
                  ? contact.phoneNumbers[0].number
                  : undefined;

              const email =
                contact.emails && contact.emails.length > 0 ? contact.emails[0].email : undefined;

              // Skip contacts without any contact method
              if (!phoneNumber && !email) continue;

              processedContacts.push({
                id: contact.id,
                name: contact.name || "Unknown",
                phoneNumber,
                email,
                selected: false,
              });
            }

            setContacts(processedContacts);
            setFilteredContacts(processedContacts);
          } else {
            setError("No contacts found on this device");
          }
        } else {
          setHasPermission(false);
          setError("Permission to access contacts was denied");
        }
      } catch (err) {
        setError(
          `Failed to load contacts: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        console.error("Error fetching contacts:", err);
      } finally {
        setLoading(false);
      }
    };

    getContacts();
  }, []);

  // Filter contacts based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter((contact) =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  // Toggle contact selection
  const toggleContactSelection = (id: string) => {
    setContacts((prevContacts) =>
      prevContacts.map((contact) => {
        if (contact.id === id) {
          const newSelectedState = !contact.selected;

          // Update selectedContacts state based on new selection
          if (newSelectedState) {
            setSelectedContacts((prev) => [...prev, { ...contact, selected: true }]);
          } else {
            setSelectedContacts((prev) => prev.filter((c) => c.id !== id));
          }

          return { ...contact, selected: newSelectedState };
        }
        return contact;
      })
    );

    // Also update filtered contacts to maintain UI consistency
    setFilteredContacts((prevFiltered) =>
      prevFiltered.map((contact) => {
        if (contact.id === id) {
          return { ...contact, selected: !contact.selected };
        }
        return contact;
      })
    );
  };

  // Generate share message
  const generateShareMessage = () => {
    const { title, time, location, description } = eventDetails;

    let message = customMessage ? `${customMessage}\n\n` : "";
    message += `Event: ${title}\n`;
    message += `When: ${time}\n`;
    message += `Where: ${location}\n`;

    if (description) {
      message += `Details: ${description}\n`;
    }

    message += `\nJoin me at this event!`;

    return message;
  };

  // Share event with selected contacts
  const shareEvent = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert("No contacts selected", "Please select at least one contact to share with.");
      return;
    }

    try {
      const message = generateShareMessage();

      // This is a simplified version. In a real app, you would likely:
      // 1. Use a specific sharing library based on platform (SMS, email, etc.)
      // 2. Handle different share methods based on available contact info
      // 3. Potentially track sharing status in your backend

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(message, {
          dialogTitle: `Share "${eventDetails.title}" with ${selectedContacts.length} contacts`,
          mimeType: "text/plain",
          UTI: "public.plain-text",
        });

        Alert.alert(
          "Shared Successfully",
          `Event shared with ${selectedContacts.length} contacts!`,
          [{ text: "OK", onPress: onClose }]
        );
      } else {
        Alert.alert("Sharing not available", "Sharing is not available on this device");
      }
    } catch (err) {
      Alert.alert(
        "Share Failed",
        `Failed to share event: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  // Request permission again if denied
  const requestPermissionAgain = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setHasPermission(true);
      setError(null);
      // Re-fetch contacts
      setLoading(true);
      // ... (similar to the first useEffect)
    } else {
      Alert.alert(
        "Permission Required",
        "This feature requires access to your contacts. Please enable it in your device settings."
      );
    }
  };

  // Render contact item
  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[styles.contactItem, item.selected && styles.contactItemSelected]}
      onPress={() => toggleContactSelection(item.id)}
    >
      <View style={styles.contactAvatarPlaceholder}>
        <Text style={styles.contactInitial}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.phoneNumber && <Text style={styles.contactDetail}>{item.phoneNumber}</Text>}
        {item.email && !item.phoneNumber && <Text style={styles.contactDetail}>{item.email}</Text>}
      </View>
      <View style={styles.checkboxContainer}>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#93c5fd" />
        <Text style={{ color: "#f8f9fa", fontFamily: "SpaceMono" }}>Loading contacts...</Text>
      </View>
    );
  }

  if (error && !hasPermission) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissionAgain}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
            // Re-fetch logic
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.actionContent}>
      <View style={styles.eventPreview}>
        <Text style={styles.previewTitle}>{eventDetails.title}</Text>
        <Text style={styles.previewTime}>{eventDetails.time}</Text>
        <Text style={styles.previewLocation}>{eventDetails.location}</Text>
      </View>

      <View style={styles.customMessageContainer}>
        <TextInput
          style={styles.customMessageInput}
          placeholder="Add a personal message (optional)"
          placeholderTextColor="#adb5bd"
          value={customMessage}
          onChangeText={setCustomMessage}
          multiline
          maxLength={200}
        />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#adb5bd"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <Text style={styles.sectionTitle}>Select contacts ({selectedContacts.length} selected)</Text>

      <FlatList
        data={filteredContacts}
        renderItem={renderContactItem}
        keyExtractor={(item) => item.id}
        style={styles.contactsList}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.shareButton, selectedContacts.length === 0 && styles.shareButtonDisabled]}
          onPress={shareEvent}
          disabled={selectedContacts.length === 0}
        >
          <Text style={styles.shareButtonText}>
            Share with {selectedContacts.length} Contact{selectedContacts.length !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ShareEvent;
