import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import Mapbox from "@rnmapbox/maps";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";

// Available emojis for animation (expanded set with tech and travel themes)
const EMOJIS = [
  "🗺️",
  "📍",
  "🚗",
  "🏠",
  "🏢",
  "🌳",
  "🚲",
  "🛣️",
  "🏙️",
  "🏔️",
  "☕",
  "🍔",
  "🛹",
  "💪",
  "👨‍💻",
  "📱",
  "💻",
  "🌐",
  "📡",
  "🛰️",
  "🔍",
  "📊",
  "📈",
  "🚀",
  "🛸",
  "✈️",
  "🚄",
  "🚢",
  "🏝️",
  "⛰️",
  "🌋",
  "🏕️",
  "🌉",
  "🌁",
  "🌇",
  "🌆",
  "🌃",
  "🗿",
  "🏛️",
  "🏰",
  "⛺",
  "🎭",
  "🎡",
  "🎢",
  "🚦",
];

// Emoji animation configuration
const EMOJI_SIZE = 46; // Increased size
const EMISSION_INTERVAL = 800; // ms between emoji emissions
const MAX_ACTIVE_EMOJIS = 12;
const ANIMATION_DURATION = 4000; // ms
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// Array of interesting map locations to choose from
const MAP_LOCATIONS = [
  // San Francisco
  {
    centerCoordinate: [-122.4324, 37.78825],
    zoomLevel: 12,
    styleURL: Mapbox.StyleURL.Dark,
  },
  // New York
  {
    centerCoordinate: [-74.006, 40.7128],
    zoomLevel: 12,
    styleURL: Mapbox.StyleURL.Dark,
  },
  // Tokyo
  {
    centerCoordinate: [139.6503, 35.6762],
    zoomLevel: 12,
    styleURL: Mapbox.StyleURL.Dark,
  },
  // London
  {
    centerCoordinate: [-0.1278, 51.5074],
    zoomLevel: 12,
    styleURL: Mapbox.StyleURL.Dark,
  },
  // Sydney
  {
    centerCoordinate: [151.2093, -33.8688],
    zoomLevel: 12,
    styleURL: Mapbox.StyleURL.Dark,
  },
];

// Function to get a random map location
const getRandomLocation = () => {
  return MAP_LOCATIONS[Math.floor(Math.random() * MAP_LOCATIONS.length)];
};

interface AnimatedEmojiProps {
  emoji: string;
  startX: number;
  startY: number;
  index: number;
  onComplete: () => void;
}

export const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  emoji,
  startX,
  startY,
  index,
  onComplete,
}) => {
  // Animation values
  const translateY = useSharedValue(startY);
  const translateX = useSharedValue(startX);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(Math.random() * 40 - 20); // Random initial rotation

  // Function to call when animation completes
  const handleAnimationComplete = () => {
    onComplete();
  };

  useEffect(() => {
    // Create random trajectory with more variety
    const distance = 100 + Math.random() * 300;
    const angle = Math.random() * Math.PI * 2; // Random angle in radians (full 360°)

    // Calculate target position based on angle and distance
    const targetX = startX + Math.cos(angle) * distance;
    const targetY = startY + Math.sin(angle) * distance * 0.6 - 200; // Mostly upward bias

    // Add some random bounce/wobble
    const springConfig = {
      damping: 8 + Math.random() * 12, // Varying damping
      stiffness: 60 + Math.random() * 40, // Varying stiffness
      mass: 0.8 + Math.random() * 0.4, // Varying mass
    };

    // Start animation sequence with staggered delay based on index
    const staggerDelay = index * (80 + Math.random() * 40);

    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        staggerDelay,
        withSequence(
          withTiming(1.2, {
            // Scale up to slightly larger than final size
            duration: 300 + Math.random() * 200,
            easing: Easing.out(Easing.back(2.0 + Math.random())),
          }),
          withTiming(1, {
            // Scale back down to normal size
            duration: 200,
            easing: Easing.inOut(Easing.sin),
          })
        )
      )
    );

    opacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        staggerDelay,
        withTiming(1, { duration: 300 }) // Full opacity instead of 0.9
      ),
      withDelay(
        ANIMATION_DURATION - 800,
        withTiming(0, { duration: 800 }, () => {
          runOnJS(handleAnimationComplete)();
        })
      )
    );

    translateY.value = withDelay(
      staggerDelay,
      withSequence(withTiming(startY, { duration: 0 }), withSpring(targetY, springConfig))
    );

    translateX.value = withDelay(
      staggerDelay,
      withSequence(withTiming(startX, { duration: 0 }), withSpring(targetX, springConfig))
    );

    // Add subtle rotation animation
    rotation.value = withDelay(
      staggerDelay,
      withSequence(
        withTiming(rotation.value, { duration: 0 }),
        withSpring(rotation.value + (Math.random() * 60 - 30), {
          damping: 10,
          stiffness: 30,
        })
      )
    );

    // No cleanup needed for animations as they complete naturally
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.emojiContainer, animatedStyle]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
};

interface AnimatedEmission {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
  index: number;
}

interface AnimatedMapBackgroundProps {
  initialLocation?: (typeof MAP_LOCATIONS)[0];
  locationChangeInterval?: number; // Time between location changes in ms
}

const AnimatedMapBackground: React.FC<AnimatedMapBackgroundProps> = ({
  initialLocation,
  locationChangeInterval = 15000, // Default to 15 seconds
}) => {
  const [activeEmissions, setActiveEmissions] = useState<AnimatedEmission[]>([]);
  const [currentLocation, setCurrentLocation] = useState<(typeof MAP_LOCATIONS)[0]>(
    initialLocation || getRandomLocation()
  );
  const emissionCount = useRef(0);
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [emissionPoints, setEmissionPoints] = useState<{ x: number; y: number }[]>([]);
  const locationChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Change map location periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const newLocation = getRandomLocation();
      setCurrentLocation(newLocation);

      // Animate to the new location
      cameraRef.current?.setCamera({
        centerCoordinate: newLocation.centerCoordinate,
        zoomLevel: newLocation.zoomLevel,
        animationDuration: 2000,
      });

      // Clear existing emission points when location changes
      setEmissionPoints([]);

      // Generate new emission points after a short delay
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }

      locationChangeTimeoutRef.current = setTimeout(() => {
        generateEmissionPoints();
      }, 300);
    }, locationChangeInterval);

    // Cleanup function for the interval
    return () => {
      clearInterval(interval);
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }
    };
  }, [locationChangeInterval]);

  // Generate emission points based on visible map coordinates
  const generateEmissionPoints = () => {
    const newPoints: { x: number; y: number }[] = [];

    // Generate 8-15 random emission points
    const numPoints = 8 + Math.floor(Math.random() * 8);

    for (let i = 0; i < numPoints; i++) {
      // Create points spread across the screen, with some clustering effect
      let x, y;

      // 70% chance of clustered points, 30% chance of random points
      if (Math.random() < 0.7 && newPoints.length > 0) {
        // Create a point near an existing point (clustering)
        const referencePoint = newPoints[Math.floor(Math.random() * newPoints.length)];
        const spread = 80 + Math.random() * 120; // Cluster spread radius

        x = referencePoint.x + (Math.random() * spread * 2 - spread);
        y = referencePoint.y + (Math.random() * spread * 2 - spread);

        // Keep within screen bounds
        x = Math.max(20, Math.min(SCREEN_WIDTH - 20, x));
        y = Math.max(20, Math.min(SCREEN_HEIGHT - 20, y));
      } else {
        // Create a completely random point
        x = 20 + Math.random() * (SCREEN_WIDTH - 40);
        y = 100 + Math.random() * (SCREEN_HEIGHT - 200); // Avoid very top and bottom edges
      }

      newPoints.push({ x, y });
    }

    setEmissionPoints(newPoints);
  };

  // Initialize emission points
  useEffect(() => {
    generateEmissionPoints();

    // No cleanup needed as this runs once
  }, []);

  // Function to generate a new emoji emission
  const generateEmission = () => {
    if (activeEmissions.length >= MAX_ACTIVE_EMOJIS || emissionPoints.length === 0) return;

    const id = `emoji-${emissionCount.current++}`;
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    // Pick a random emission point
    const emissionPoint = emissionPoints[Math.floor(Math.random() * emissionPoints.length)];

    // Add some randomness to the exact position
    const startX = emissionPoint.x + (Math.random() * 40 - 20);
    const startY = emissionPoint.y + (Math.random() * 40 - 20);

    setActiveEmissions((prev) => [
      ...prev,
      {
        id,
        emoji: randomEmoji,
        startX,
        startY,
        index: prev.length,
      },
    ]);
  };

  // Function to remove an emoji emission when animation completes
  const removeEmission = (id: string) => {
    setActiveEmissions((prev) => prev.filter((emission) => emission.id !== id));
  };

  // Reference to the emoji emission interval
  const emissionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the emission interval
  useEffect(() => {
    emissionIntervalRef.current = setInterval(generateEmission, EMISSION_INTERVAL);

    // Cleanup function for the interval
    return () => {
      if (emissionIntervalRef.current) {
        clearInterval(emissionIntervalRef.current);
      }
    };
  }, [activeEmissions.length, emissionPoints]);

  // Reference to the map initialization timeout
  const mapLoadedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle map loaded event
  const onMapLoaded = () => {
    // Generate new emission points once map is ready
    if (mapLoadedTimeoutRef.current) {
      clearTimeout(mapLoadedTimeoutRef.current);
    }

    mapLoadedTimeoutRef.current = setTimeout(generateEmissionPoints, 500);
  };

  // Final cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timeouts and intervals
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }
      if (emissionIntervalRef.current) {
        clearInterval(emissionIntervalRef.current);
      }
      if (mapLoadedTimeoutRef.current) {
        clearTimeout(mapLoadedTimeoutRef.current);
      }

      // Clear emission points to prevent memory leaks
      setEmissionPoints([]);
      setActiveEmissions([]);

      // Reset other states
      emissionCount.current = 0;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={currentLocation.styleURL}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={onMapLoaded}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={currentLocation.zoomLevel}
          centerCoordinate={currentLocation.centerCoordinate}
          animationMode="flyTo"
          animationDuration={2000}
        />
      </Mapbox.MapView>

      <View style={styles.overlay} />

      {activeEmissions.map((emission) => (
        <AnimatedEmoji
          key={emission.id}
          emoji={emission.emoji}
          startX={emission.startX}
          startY={emission.startY}
          index={emission.index}
          onComplete={() => removeEmission(emission.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Ensure it stays behind other elements
    position: "absolute",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34, 34, 34, 0.9)", // Even darker overlay to increase contrast
  },
  emojiContainer: {
    position: "absolute",
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    borderRadius: EMOJI_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A", // Darker charcoal filled
    borderWidth: 2, // Return to original border thickness
    borderColor: "#4dabf7", // Tech-blue border matching your accent color
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, // Reduced shadow opacity
    shadowRadius: 5, // Smaller shadow radius
    elevation: 4, // Reduced elevation for Android
    zIndex: 0, // Ensure emojis stay behind login elements
  },
  emoji: {
    fontSize: 22, // Slightly larger emoji
    textAlign: "center",
  },
  mapMarker: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(77, 171, 247, 0.6)",
    borderWidth: 1,
    borderColor: "#4dabf7",
  },
});

export default AnimatedMapBackground;
