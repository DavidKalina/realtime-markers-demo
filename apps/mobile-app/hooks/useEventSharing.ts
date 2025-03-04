import { useState } from "react";
import { Platform, Linking, Alert } from "react-native";

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  selected: boolean;
}

interface Event {
  title: string;
  time: string;
  location: string;
  description?: string;
}

interface MapLinks {
  universalLink: string;
  googleLink: string;
  appleLink: string;
}

interface SharingProgress {
  inProgress: boolean;
  current: number;
  total: number;
}

interface UseEventSharingReturn {
  customMessage: string;
  setCustomMessage: (message: string) => void;
  sharingProgress: SharingProgress;
  shareViaDirectSMS: () => Promise<void>;
  shareViaEmail: () => Promise<void>;
  generateShareMessage: () => string;
}

export const useEventSharing = (
  event: Event | null,
  selectedContacts: Contact[],
  mapLinks: MapLinks | null,
  defaultMessage: string = `Check out this event I'm attending!`
): UseEventSharingReturn => {
  const [customMessage, setCustomMessage] = useState(defaultMessage);
  const [sharingProgress, setSharingProgress] = useState<SharingProgress>({
    inProgress: false,
    current: 0,
    total: 0,
  });

  // Generate share message
  const generateShareMessage = (): string => {
    if (!event) {
      return "Sorry, event details are not available.";
    }

    const { title, time, location, description } = event;

    let message = customMessage ? `${customMessage}\n\n` : "";
    message += `Event: ${title}\n`;
    message += `When: ${time}\n`;
    message += `Where: ${location}\n`;

    // Add map link - Google Maps is more universal so we use that in the message
    if (mapLinks) {
      message += `Location Map: ${mapLinks.googleLink}\n`;
    }

    if (description) {
      message += `Details: ${description}\n`;
    }

    message += `\nJoin me at this event!`;

    return message;
  };

  // Function to send SMS to a single contact
  const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
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
  const shareViaDirectSMS = async (): Promise<void> => {
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
                [{ text: "OK" }]
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
          Alert.alert("Message Sent", `Event shared with ${contact.name}!`, [{ text: "OK" }]);
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
  const shareViaEmail = async (): Promise<void> => {
    if (!event) return;

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

  return {
    customMessage,
    setCustomMessage,
    sharingProgress,
    shareViaDirectSMS,
    shareViaEmail,
    generateShareMessage,
  };
};
