// ShareView.tsx - Updated with contact selection
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import {
  ArrowLeft,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  Link,
  Search,
  Check,
  User,
  Users,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Contacts from "expo-contacts";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  SlideInUp,
} from "react-native-reanimated";
import { styles } from "./styles";
import { EventType } from "./types";

interface ShareViewProps {
  isVisible: boolean;
  event: EventType;
  onClose: () => void;
}

// Mock contact type
// Contact type that combines Expo.Contact with our additional properties
interface Contact {
  id: string;
  name: string;
  contactType?: string;
  imageAvailable?: boolean;
  image?: { uri?: string } | undefined;
  phoneNumbers?: Array<{ id?: string; label?: string; number: string }> | undefined;
  emails?: Array<{ id?: string; label?: string; email: string }> | undefined;
  recent?: boolean;
}

export const ShareView: React.FC<ShareViewProps> = ({ isVisible, event, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"contacts" | "share">("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">(
    "undetermined"
  );
  const [recentContactIds, setRecentContactIds] = useState<string[]>(["1", "2", "3"]); // Mock recent contacts - in real app would be stored in AsyncStorage

  // Animation values
  const animationProgress = useSharedValue(0);

  // Load contacts
  useEffect(() => {
    if (isVisible) {
      fetchContacts();
    }
  }, [isVisible]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      // Request permission to access contacts
      const { status } = await Contacts.requestPermissionsAsync();
      setPermissionStatus(status as "undetermined" | "granted" | "denied");

      if (status === "granted") {
        // Get all contacts
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.ID,
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Image,
            Contacts.Fields.ImageAvailable,
          ],
          sort: Contacts.SortTypes.FirstName,
        });

        // Format contacts to match our interface
        //@ts-ignore
        const formattedContacts: Contact[] = data
          .filter((contact) => contact.id !== undefined) // Filter out contacts without IDs
          .map((contact) => ({
            id: contact.id || `generated-${Math.random().toString(36).slice(2)}`, // Ensure ID is never undefined
            name: contact.name || "Unknown",
            imageAvailable: contact.imageAvailable,
            image: contact.image,
            phoneNumbers: contact.phoneNumbers,
            emails: contact.emails,
            // Mark some contacts as recent (in a real app, this would come from actual usage history)
            recent: recentContactIds.includes(contact.id || ""),
          }));

        setContacts(formattedContacts);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered contacts based on search query
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate recent contacts
  const recentContacts = filteredContacts.filter((contact) => contact.recent);
  const otherContacts = filteredContacts.filter((contact) => !contact.recent);

  // Trigger animation when visibility changes
  useEffect(() => {
    // Trigger haptic feedback when opening
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    animationProgress.value = withTiming(isVisible ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isVisible]);

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      transform: [
        { translateY: (1 - animationProgress.value) * 50 },
        { scale: 0.9 + animationProgress.value * 0.1 },
      ],
    };
  });

  const handleCopy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle close button
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Toggle contact selection
  const toggleContactSelection = (contactId: string) => {
    Haptics.selectionAsync();
    setSelectedContactIds((prev) => {
      if (prev.includes(contactId)) {
        return prev.filter((id) => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };

  // Share options for the share tab
  const shareOptions = [
    { id: "message", name: "Messages", icon: <MessageSquare size={20} color="#4dabf7" /> },
    { id: "email", name: "Email", icon: <Mail size={20} color="#4dabf7" /> },
    { id: "copy", name: "Copy Link", icon: <Copy size={20} color="#4dabf7" /> },
    { id: "more", name: "More Options", icon: <Link size={20} color="#4dabf7" /> },
  ];

  const shareText = `Check out this event: ${event.title} at ${event.location} on ${event.time}. ${event.description}`;

  // Don't render if not visible and animation is complete
  if (!isVisible && animationProgress.value === 0) {
    return null;
  }

  const renderContactItem = ({ item }: { item: Contact }) => {
    // Get contact's first initial for avatar fallback
    const initial = item.name && item.name.charAt(0).toUpperCase();

    // Get contact details for subtitle
    const phoneNumber =
      item.phoneNumbers && item.phoneNumbers.length > 0 ? item.phoneNumbers[0].number : "";
    const email = item.emails && item.emails.length > 0 ? item.emails[0].email : "";
    const subtitle = phoneNumber || email || "";

    return (
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: selectedContactIds.includes(item.id) ? "#3a3a3a" : "#2a2a2a",
          padding: 12,
          borderRadius: 10,
          marginBottom: 10,
        }}
        onPress={() => toggleContactSelection(item.id)}
      >
        {/* Contact avatar - would use item.image.uri if imageAvailable in a real app */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#4dabf7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {item.imageAvailable ? (
            <Text>Image</Text> // Replace with Image component using item.image.uri
          ) : (
            <Text
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              {initial}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#f8f9fa",
              fontSize: 14,
              fontFamily: "SpaceMono",
            }}
          >
            {item.name}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: "#adb5bd",
                fontSize: 12,
                fontFamily: "SpaceMono",
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: selectedContactIds.includes(item.id) ? "#4dabf7" : "#5a5a5a",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selectedContactIds.includes(item.id) ? "#4dabf7" : "transparent",
          }}
        >
          {selectedContactIds.includes(item.id) && <Check size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderContactSection = () => {
    // Permission denied state
    if (permissionStatus === "denied") {
      return (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <AlertCircle size={40} color="#f87171" style={{ marginBottom: 16 }} />
          <Text
            style={{
              color: "#f8f9fa",
              fontSize: 16,
              fontFamily: "SpaceMono",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Contact Access Required
          </Text>
          <Text
            style={{
              color: "#adb5bd",
              fontSize: 14,
              fontFamily: "SpaceMono",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Please allow access to your contacts in your device settings to share this event.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#4dabf7",
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
            onPress={fetchContacts}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "SpaceMono",
                fontSize: 14,
              }}
            >
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Loading state
    if (isLoading) {
      return (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <ActivityIndicator size="large" color="#4dabf7" style={{ marginBottom: 16 }} />
          <Text
            style={{
              color: "#f8f9fa",
              fontSize: 14,
              fontFamily: "SpaceMono",
            }}
          >
            Loading contacts...
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* Search bar */}
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#2a2a2a",
            borderRadius: 10,
            paddingHorizontal: 12,
            marginBottom: 16,
          }}
          entering={FadeIn.delay(200).duration(300)}
        >
          <Search size={16} color="#4dabf7" style={{ marginRight: 8 }} />
          <TextInput
            style={{
              flex: 1,
              color: "#f8f9fa",
              fontSize: 14,
              fontFamily: "SpaceMono",
              paddingVertical: 12,
            }}
            placeholder="Search contacts"
            placeholderTextColor="#767676"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#3a3a3a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#f8f9fa", fontSize: 14, lineHeight: 14 }}>×</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Selected count */}
        {selectedContactIds.length > 0 && (
          <Animated.View
            style={{
              backgroundColor: "#4dabf7",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignSelf: "flex-start",
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
            }}
            entering={FadeIn.duration(200)}
          >
            <Users size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text
              style={{
                color: "#fff",
                fontSize: 12,
                fontFamily: "SpaceMono",
              }}
            >
              {selectedContactIds.length} selected
            </Text>
          </Animated.View>
        )}

        {/* No contacts state */}
        {contacts.length === 0 && !isLoading && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <Users size={40} color="#adb5bd" style={{ marginBottom: 16 }} />
            <Text
              style={{
                color: "#f8f9fa",
                fontSize: 16,
                fontFamily: "SpaceMono",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              No Contacts Found
            </Text>
            <Text
              style={{
                color: "#adb5bd",
                fontSize: 14,
                fontFamily: "SpaceMono",
                textAlign: "center",
              }}
            >
              We couldn't find any contacts on your device.
            </Text>
          </View>
        )}

        {/* Recent contacts section */}
        {recentContacts.length > 0 && (
          <Animated.View entering={SlideInUp.delay(250).duration(300)}>
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 10,
                fontFamily: "SpaceMono",
              }}
            >
              Recent
            </Text>
            <FlatList
              data={recentContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </Animated.View>
        )}

        {/* All contacts section */}
        {contacts.length > 0 && (
          <Animated.View
            style={{ marginTop: recentContacts.length > 0 ? 16 : 0 }}
            entering={SlideInUp.delay(300).duration(300)}
          >
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 10,
                fontFamily: "SpaceMono",
              }}
            >
              {searchQuery.length > 0 ? "Search Results" : "All Contacts"}
            </Text>
            <FlatList
              data={otherContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={() => (
                <Text
                  style={{
                    color: "#adb5bd",
                    textAlign: "center",
                    padding: 20,
                    fontFamily: "SpaceMono",
                  }}
                >
                  {searchQuery.length > 0 ? "No contacts found" : "No contacts available"}
                </Text>
              )}
            />
          </Animated.View>
        )}
      </>
    );
  };

  const renderCustomizeSection = () => (
    <>
      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <Text style={styles.label}>Customize Message</Text>
        <TextInput
          style={[
            styles.value,
            {
              height: 100,
              textAlignVertical: "top",
              backgroundColor: "#2a2a2a",
              borderRadius: 8,
              padding: 12,
              marginTop: 8,
            },
          ]}
          multiline
          value={shareText}
          editable={true}
        />
      </Animated.View>

      <Animated.View style={{ marginTop: 20 }} entering={FadeIn.delay(300).duration(400)}>
        <Text style={styles.label}>Share Via</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          {shareOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={{
                width: "48%",
                backgroundColor: "#3a3a3a",
                padding: 12,
                borderRadius: 10,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => option.id === "copy" && handleCopy()}
            >
              {option.icon}
              <Text
                style={{
                  color: "#f8f9fa",
                  marginLeft: 8,
                  fontSize: 14,
                  fontFamily: "SpaceMono",
                }}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {copied && (
          <Animated.Text
            entering={FadeIn.duration(200)}
            style={{
              color: "#4dabf7",
              textAlign: "center",
              marginTop: 8,
              fontSize: 14,
              fontFamily: "SpaceMono",
            }}
          >
            Link copied to clipboard!
          </Animated.Text>
        )}
      </Animated.View>
    </>
  );

  return (
    <Animated.View style={[styles.detailsScreenContainer, containerAnimatedStyle]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Event</Text>
      </View>

      {/* Tab navigation */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#3a3a3a",
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            alignItems: "center",
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "contacts" ? "#4dabf7" : "transparent",
          }}
          onPress={() => setActiveTab("contacts")}
        >
          <Text
            style={{
              color: activeTab === "contacts" ? "#4dabf7" : "#f8f9fa",
              fontFamily: "SpaceMono",
              fontSize: 14,
            }}
          >
            Contacts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            padding: 12,
            alignItems: "center",
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "share" ? "#4dabf7" : "transparent",
          }}
          onPress={() => setActiveTab("share")}
        >
          <Text
            style={{
              color: activeTab === "share" ? "#4dabf7" : "#f8f9fa",
              fontFamily: "SpaceMono",
              fontSize: 14,
            }}
          >
            Message
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Event Preview */}
        <Animated.View
          style={[styles.detailsCard, { marginBottom: 16 }]}
          entering={SlideInUp.delay(100).springify().damping(15)}
        >
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleContainer}>
              <Text style={styles.emoji}>{event.emoji}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
            </View>
          </View>

          <Animated.View entering={FadeIn.delay(150).duration(300)}>
            <Text style={styles.value}>
              {event.time} at {event.location}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Tab content */}
        <Animated.View
          style={styles.detailsCard}
          entering={SlideInUp.delay(150).springify().damping(15)}
        >
          {activeTab === "contacts" ? renderContactSection() : renderCustomizeSection()}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            { opacity: selectedContactIds.length === 0 ? 0.5 : 1 },
          ]}
          onPress={() => {
            if (selectedContactIds.length > 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setActiveTab("share");
            }
          }}
          disabled={selectedContactIds.length === 0}
        >
          {activeTab === "contacts" ? (
            <>
              <Users size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Next ({selectedContactIds.length})</Text>
            </>
          ) : (
            <>
              <Share2 size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>
                Share with {selectedContactIds.length}{" "}
                {selectedContactIds.length === 1 ? "Contact" : "Contacts"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
