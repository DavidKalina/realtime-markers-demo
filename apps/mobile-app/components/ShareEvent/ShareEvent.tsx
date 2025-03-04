import apiClient from "@/services/ApiClient";
import * as Contacts from "expo-contacts";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ShareEventSkeleton } from "./ShareEventSkeleton";
import { styles } from "./styles";
import { styles as globalStyles } from "@/components/globalStyles";

interface ShareEventProps {
  eventId: string;
  onClose: () => void;
  prefillMessage?: string;
}

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  selected: boolean;
}

const ShareEvent: React.FC<ShareEventProps> = ({
  eventId,
  onClose,
  prefillMessage = `Check out this event I'm attending!`,
}) => {
  const [event, setEvent] = useState<any | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true since we need to fetch event
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [customMessage, setCustomMessage] = useState(prefillMessage);
  // Add states to track sharing progress and map links
  const [sharingProgress, setSharingProgress] = useState({
    inProgress: false,
    current: 0,
    total: 0,
  });
  const [mapLinks, setMapLinks] = useState<{
    universalLink: string;
    googleLink: string;
    appleLink: string;
  } | null>(null);

  // Fetch event details when eventId changes
  useEffect(() => {
    let isMounted = true;

    const fetchEventDetails = async () => {
      if (!eventId) return;

      setLoading(true);
      setError(null);

      try {
        const eventData = await apiClient.getEventById(eventId);
        if (isMounted) {
          setEvent(eventData);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            `Failed to load event details: ${err instanceof Error ? err.message : "Unknown error"}`
          );
          console.error("Error fetching event details:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Only fetch if we don't have details passed as props
    fetchEventDetails();
    // If we have details as props, just use those directly

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Generate map link for the location
  const generateMapLink = () => {
    const { location, coordinates } = event;
    // Encode the location for URL
    const encodedLocation = encodeURIComponent(location);

    // If we have precise coordinates, use them for more accurate mapping
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      const { latitude, longitude } = coordinates;

      // Create Apple Maps link with exact coordinates
      const appleMapLink = `https://maps.apple.com/?q=${encodedLocation}&ll=${latitude},${longitude}`;

      // Create Google Maps link with exact coordinates
      const googleMapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

      return {
        universalLink: Platform.OS === "ios" ? appleMapLink : googleMapLink,
        googleLink: googleMapLink,
        appleLink: appleMapLink,
      };
    } else {
      // Create universal map link that works on both iOS and Android, but just with location name
      const mapLink = `https://maps.apple.com/?q=${encodedLocation}`;

      // Alternative: create a Google Maps link that works on both platforms
      const googleMapLink = `https://maps.google.com/?q=${encodedLocation}`;

      return {
        universalLink: Platform.OS === "ios" ? mapLink : googleMapLink,
        googleLink: googleMapLink,
        appleLink: mapLink,
      };
    }
  };

  // Generate map links when event details change
  useEffect(() => {
    if (event) {
      const links = generateMapLink();
      setMapLinks(links);
    }
  }, [event]);

  // Request contacts permission and fetch contacts
  useEffect(() => {
    // Don't fetch contacts if we're still loading event details
    if (!event) return;

    const getContacts = async () => {
      setLoading(true);

      try {
        const { status } = await Contacts.requestPermissionsAsync();

        if (status === "granted") {
          setHasPermission(true);

          // Add error handling around the contacts fetch
          try {
            const { data } = await Contacts.getContactsAsync({
              fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            });

            // Better error handling for empty data
            if (!data || data.length === 0) {
              setContacts([]);
              setFilteredContacts([]);
              setError("No contacts found on this device");
              setLoading(false);
              return;
            }

            // Safe mapping function for contacts that ensures valid IDs
            const processedContacts: Contact[] = [];

            for (const contact of data) {
              // Skip contacts without an ID or name
              if (!contact.id) continue;

              // Safely access phoneNumber - add defensive coding
              let phoneNumber: string | undefined = undefined;
              if (
                contact.phoneNumbers &&
                Array.isArray(contact.phoneNumbers) &&
                contact.phoneNumbers.length > 0 &&
                contact.phoneNumbers[0]?.number
              ) {
                phoneNumber = contact.phoneNumbers[0].number;
              }

              // Safely access email - add defensive coding
              let email: string | undefined = undefined;
              if (
                contact.emails &&
                Array.isArray(contact.emails) &&
                contact.emails.length > 0 &&
                contact.emails[0]?.email
              ) {
                email = contact.emails[0].email;
              }

              // Only include contacts with at least one contact method
              if (phoneNumber || email) {
                processedContacts.push({
                  id: contact.id,
                  name: contact.name || "Unknown",
                  phoneNumber,
                  email,
                  selected: false,
                });
              }
            }

            setContacts(processedContacts);
            setFilteredContacts(processedContacts);
          } catch (contactsError) {
            console.error("Error processing contacts:", contactsError);
            setError(
              `Failed to process contacts: ${
                contactsError instanceof Error ? contactsError.message : "Unknown error"
              }`
            );
          }
        } else {
          setHasPermission(false);
          setError("Permission to access contacts was denied");
        }
      } catch (permissionErr) {
        console.error("Permission error:", permissionErr);
        setError(
          `Failed to request contacts permission: ${
            permissionErr instanceof Error ? permissionErr.message : "Unknown error"
          }`
        );
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    getContacts();
  }, [event]);

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
    if (!event) {
      return "Sorry, event details are not available.";
    }

    const { title, time, location, description } = event;
    const mapLinks = generateMapLink();

    let message = customMessage ? `${customMessage}\n\n` : "";
    message += `Event: ${title}\n`;
    message += `When: ${time}\n`;
    message += `Where: ${location}\n`;

    // Add map link - Google Maps is more universal so we use that in the message
    message += `Location Map: ${mapLinks.googleLink}\n`;

    if (description) {
      message += `Details: ${description}\n`;
    }

    message += `\nJoin me at this event!`;

    return message;
  };

  // Function to send SMS to a single contact
  const sendSMS = async (phoneNumber: string, message: string) => {
    // Format phone number by removing non-digit characters
    const formattedNumber = phoneNumber.replace(/\D/g, "");

    // Create SMS URI
    let smsUri = "";

    if (Platform.OS === "ios") {
      // iOS uses & for query parameters in SMS links
      smsUri = `sms:${formattedNumber}&body=${encodeURIComponent(message)}`;
    } else {
      // Android uses ? for query parameters in SMS links
      smsUri = `sms:${formattedNumber}?body=${encodeURIComponent(message)}`;
    }

    // Check if linking can open the URL
    const canOpen = await Linking.canOpenURL(smsUri);

    if (canOpen) {
      await Linking.openURL(smsUri);
      return true;
    } else {
      console.error(`Cannot open URL: ${smsUri}`);
      return false;
    }
  };

  // Share event with selected contacts directly via SMS
  const shareViaDirectSMS = async () => {
    // Check if any contacts with phone numbers are selected
    const contactsWithPhone = selectedContacts.filter((contact) => contact.phoneNumber);

    if (contactsWithPhone.length === 0) {
      Alert.alert(
        "No phone numbers available",
        "None of the selected contacts have phone numbers. Please select contacts with phone numbers."
      );
      return;
    }

    // Generate message
    const message = generateShareMessage();

    // Set up progress tracking
    setSharingProgress({
      inProgress: true,
      current: 0,
      total: contactsWithPhone.length,
    });

    // Ask for confirmation if multiple contacts selected
    if (contactsWithPhone.length > 1) {
      Alert.alert(
        "Send Multiple Messages",
        `You're about to send individual messages to ${contactsWithPhone.length} contacts. Would you like to proceed?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setSharingProgress({ inProgress: false, current: 0, total: 0 }),
          },
          {
            text: "Send",
            onPress: async () => {
              // For each contact with a phone number, send an SMS
              for (let i = 0; i < contactsWithPhone.length; i++) {
                const contact = contactsWithPhone[i];
                if (contact.phoneNumber) {
                  setSharingProgress({
                    inProgress: true,
                    current: i + 1,
                    total: contactsWithPhone.length,
                  });

                  try {
                    await sendSMS(contact.phoneNumber, message);
                    // Add a slight delay between messages to avoid overwhelming the system
                    if (i < contactsWithPhone.length - 1) {
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                  } catch (error) {
                    console.error(`Error sending SMS to ${contact.name}:`, error);
                  }
                }
              }

              // Complete
              setSharingProgress({ inProgress: false, current: 0, total: 0 });

              // Show success message
              Alert.alert(
                "Messages Sent",
                `Event shared with ${contactsWithPhone.length} contact${
                  contactsWithPhone.length !== 1 ? "s" : ""
                }!`,
                [{ text: "OK", onPress: onClose }]
              );
            },
          },
        ]
      );
    } else {
      // Single contact - just send directly
      const contact = contactsWithPhone[0];
      if (contact.phoneNumber) {
        try {
          await sendSMS(contact.phoneNumber, message);

          // Show success message
          Alert.alert("Message Sent", `Event shared with ${contact.name}!`, [
            { text: "OK", onPress: onClose },
          ]);
        } catch (error) {
          console.error(`Error sending SMS to ${contact.name}:`, error);
          Alert.alert("Sending Failed", `Unable to send SMS to ${contact.name}. Please try again.`);
        } finally {
          setSharingProgress({ inProgress: false, current: 0, total: 0 });
        }
      }
    }
  };

  // Function to share via email (when contacts don't have phone numbers)
  const shareViaEmail = async () => {
    const contactsWithEmail = selectedContacts.filter((contact) => contact.email);

    if (contactsWithEmail.length === 0) {
      Alert.alert(
        "No email addresses available",
        "None of the selected contacts have email addresses. Please select contacts with email addresses."
      );
      return;
    }

    // Generate message
    const message = generateShareMessage();
    const emails = contactsWithEmail
      .map((c) => c.email)
      .filter(Boolean)
      .join(",");

    // Create email URI
    const emailUri = `mailto:${emails}?subject=${encodeURIComponent(
      event.title
    )}&body=${encodeURIComponent(message)}`;

    // Check if linking can open the URL
    const canOpen = await Linking.canOpenURL(emailUri);

    if (canOpen) {
      await Linking.openURL(emailUri);
    } else {
      console.error(`Cannot open URL: ${emailUri}`);
      Alert.alert(
        "Email Not Available",
        "Unable to open email client. Please check if you have an email app configured."
      );
    }
  };

  // Function to open map directly
  const openMap = async () => {
    if (!mapLinks) return;

    try {
      const canOpen = await Linking.canOpenURL(mapLinks.universalLink);
      if (canOpen) {
        await Linking.openURL(mapLinks.universalLink);
      } else {
        // Fall back to Google Maps if the universal link doesn't work
        await Linking.openURL(mapLinks.googleLink);
      }
    } catch (error) {
      console.error("Error opening map:", error);
      Alert.alert("Cannot Open Map", "Unable to open maps application.");
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
      key={item.id}
      style={[
        styles.contactItem,
        item.selected && styles.contactItemSelected,
        !item.phoneNumber && styles.contactItemNoPhone,
      ]}
      onPress={() => toggleContactSelection(item.id)}
    >
      <View style={styles.contactAvatarPlaceholder}>
        <Text style={styles.contactInitial}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.phoneNumber && <Text style={styles.contactDetail}>{item.phoneNumber}</Text>}
        {item.email && !item.phoneNumber && (
          <View style={styles.emailContainer}>
            <Text style={styles.contactDetail}>{item.email}</Text>
            <Text style={styles.emailWarning}>(via email)</Text>
          </View>
        )}
      </View>
      <View style={styles.checkboxContainer}>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <ShareEventSkeleton />;
  }

  // If event details couldn't be loaded, show error state
  if (!event) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>Event details could not be loaded. Please try again.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            // This will trigger the useEffect to fetch event details again
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sharingProgress.inProgress) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#93c5fd" />
        <Text style={styles.progressText}>
          Sending messages ({sharingProgress.current} of {sharingProgress.total})...
        </Text>
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

  // Count selected contacts with phone numbers
  const phoneContactsCount = selectedContacts.filter((c) => c.phoneNumber).length;
  // Count selected contacts with email only
  const emailContactsCount = selectedContacts.filter((c) => c.email && !c.phoneNumber).length;

  return (
    <View style={styles.actionContent}>
      {/* Event Preview Card */}
      <View style={styles.compactEventInfo}>
        <View style={styles.eventHeaderRow}>
          <Text style={globalStyles.eventEmoji}>{event.emoji || "🎉"}</Text>
          <View style={styles.eventTextContainer}>
            <Text style={styles.previewTitle} numberOfLines={1} ellipsizeMode="tail">
              {event.title}
            </Text>
            <Text style={styles.previewDetails} numberOfLines={1} ellipsizeMode="tail">
              {event.time} • {event.location}
            </Text>
          </View>
        </View>

        {/* Map link button */}
        <TouchableOpacity style={styles.mapButton} onPress={openMap} activeOpacity={0.7}>
          <Text style={styles.mapButtonText}>📍 Open Location in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* Search Container - Moved up for prominence */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#adb5bd"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={true}
        />
      </View>

      <Text style={styles.sectionTitle}>SELECT CONTACTS ({selectedContacts.length} SELECTED)</Text>

      {/* Contacts List - Using View instead of FlatList */}
      <View style={styles.contactsContainer}>
        {filteredContacts.map((item) => renderContactItem({ item }))}
      </View>

      {/* Custom Message Input - Moved to bottom */}
      <View style={styles.customMessageContainer}>
        <TextInput
          style={styles.customMessageInput}
          placeholder="Add a personal message"
          placeholderTextColor="#adb5bd"
          value={customMessage}
          onChangeText={setCustomMessage}
          multiline
          maxLength={200}
        />
      </View>

      {/* Footer with SMS and Email options */}
      <View style={styles.footer}>
        {/* SMS Button */}
        <TouchableOpacity
          style={[styles.shareButton, phoneContactsCount === 0 && styles.shareButtonDisabled]}
          onPress={
            phoneContactsCount > 0
              ? shareViaDirectSMS
              : () =>
                  Alert.alert(
                    "No phone contacts selected",
                    "Please select at least one contact with a phone number to send SMS."
                  )
          }
          activeOpacity={0.7}
        >
          <Text style={styles.shareButtonText}>SMS ({phoneContactsCount})</Text>
        </TouchableOpacity>

        {/* Email Button */}
        <TouchableOpacity
          style={[styles.emailButton, emailContactsCount === 0 && styles.shareButtonDisabled]}
          onPress={
            emailContactsCount > 0
              ? shareViaEmail
              : () =>
                  Alert.alert(
                    "No email contacts",
                    "None of your selected contacts have email addresses only."
                  )
          }
          activeOpacity={0.7}
        >
          <Text style={styles.emailButtonText}>EMAIL ({emailContactsCount})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ShareEvent;
