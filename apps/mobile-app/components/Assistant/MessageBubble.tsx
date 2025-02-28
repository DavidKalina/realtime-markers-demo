import React, { useState } from "react";
import { Text, View, TouchableOpacity, Linking, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { MapPin, Clock, Tag, Navigation, Share2 } from "lucide-react-native";
import { styles } from "./styles";
import { EventType } from "./types";

interface MessageBubbleProps {
  currentEvent: EventType;
  currentStreamedText: string;
  isTyping: boolean;
  messageIndex: number;
  showDetails: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  currentEvent,
  currentStreamedText,
  isTyping,
  messageIndex,
  showDetails,
}) => {
  const getMessages = (event: EventType) => [
    `I found an event near you!`,
    `${event.title} at ${event.location}.`,
    `It's ${event.distance} from your current location.`,
    `Would you like to check it out?`,
  ];

  // Animation shared values
  const locationRowScale = useSharedValue(1);
  const directionsButtonScale = useSharedValue(1);
  const shareButtonScale = useSharedValue(1);

  // Animated styles
  const locationRowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: locationRowScale.value }],
      backgroundColor: locationRowScale.value < 1 ? "rgba(55, 65, 81, 0.8)" : "transparent",
    };
  });

  const directionsButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: directionsButtonScale.value }],
    };
  });

  const shareButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: shareButtonScale.value }],
    };
  });

  // Animation handler functions
  const animatePress = (sharedValue: any) => {
    Haptics.selectionAsync();
    sharedValue.value = withTiming(0.95, { duration: 100 });
    setTimeout(() => {
      sharedValue.value = withSpring(1);
    }, 150);
  };

  const openMaps = (location: string) => {
    animatePress(locationRowScale);

    const encodedLocation = encodeURIComponent(location);
    const scheme = Platform.select({ ios: "maps:?q=", android: "geo:0,0?q=" });
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedLocation}`,
      android: `geo:0,0?q=${encodedLocation}`,
    });

    // Small delay to allow animation to complete
    setTimeout(() => {
      Linking.canOpenURL(url!)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url!);
          } else {
            // Fallback to Google Maps web URL
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch((err) => console.error("Could not open maps", err));
    }, 200);
  };

  return (
    <View style={styles.textWrapper}>
      <View style={styles.messageBubble}>
        {!showDetails ? (
          <View>
            <Text style={styles.messageText}>
              {currentStreamedText}
              {isTyping && currentStreamedText.length === 0 && <Text style={styles.dots}>•••</Text>}
              {isTyping && currentStreamedText.length > 0 && (
                <Text style={[styles.dots, { marginLeft: 4 }]}>•</Text>
              )}
            </Text>
            <View style={styles.progressDotsContainer}>
              {getMessages(currentEvent).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: idx <= messageIndex ? "#f59e0b" : "#4b5563",
                      transform: [{ scale: idx === messageIndex ? 1.1 : 1 }],
                      opacity: idx <= messageIndex ? 1 : 0.5,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.detailTitle}>{currentEvent.title}</Text>
            <Text style={styles.detailDescription}>{currentEvent.description}</Text>

            <Animated.View style={locationRowStyle}>
              <TouchableOpacity
                style={styles.interactiveDetailRow}
                onPress={() => openMaps(currentEvent.location)}
              >
                <MapPin size={14} color="#fcd34d" style={styles.icon} />
                <Text style={styles.detailText}>{currentEvent.location}</Text>
                <Navigation size={12} color="#93c5fd" style={styles.detailActionIcon} />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.detailRow}>
              <Clock size={14} color="#fcd34d" style={styles.icon} />
              <Text style={styles.detailText}>{currentEvent.time}</Text>
            </View>

            <View style={styles.categoriesContainer}>
              {currentEvent.categories.map((category, i) => (
                <View key={i} style={styles.categoryBadge}>
                  <Tag size={10} color="#fcd34d" style={styles.iconSmall} />
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>

            <View style={styles.detailActions}>
              <Animated.View style={directionsButtonStyle}>
                <TouchableOpacity
                  style={styles.detailActionButton}
                  onPress={() => {
                    animatePress(directionsButtonScale);
                    setTimeout(() => openMaps(currentEvent.location), 200);
                  }}
                >
                  <Navigation size={16} color="#fcd34d" />
                  <Text style={styles.detailActionText}>Directions</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={shareButtonStyle}>
                <TouchableOpacity
                  style={styles.detailActionButton}
                  onPress={() => animatePress(shareButtonScale)}
                >
                  <Share2 size={16} color="#fcd34d" />
                  <Text style={styles.detailActionText}>Share</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
