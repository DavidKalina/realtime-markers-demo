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
  "🎸",
  "🎤",
  "🎶",
  "🎧",
  "🥁",
  "🎹",
  "🎷",
  "🎺",
  "🎯",
  "🎳",
  "🎮",
  "🕹️",
  "🏀",
  "⚽",
  "⚾",
  "🏐",
  "🏈",
  "🎾",
  "🏉",
  "🥏",
  "🏓",
  "🥊",
  "🛼",
  "🎨",
  "🖌️",
  "🖍️",
  "🖼️",
  "📸",
  "🎬",
  "🎥",
  "🎟️",
  "🎭",
  "🎪",
  "🎞️",
  "🍻",
  "🥂",
  "🍹",
  "🎂",
  "🍕",
  "🍿",
  "🍦",
  "🍜",
  "🍣",
  "🍛",
  "🥗",
  "🛍️",
  "🛒",
  "🎁",
  "📚",
  "📖",
  "🎯",
  "🚴",
  "🧗",
  "🏌️",
  "🏇",
  "🏄",
  "🏊",
  "🤿",
  "🎽",
  "🚣",
  "🏂",
  "⛷️",
  "🎿",
  "🛷",
  "🧩",
  "♟️",
  "🎲",
  "🃏",
  "♠️",
  "♥️",
  "♦️",
  "♣️",
  "🔮",
  "🕺",
  "💃",
  "🩰",
  "🛏️",
  "🚶",
  "🏃",
  "🚶‍♀️",
  "🏃‍♀️",
  "🤹",
  "🤹‍♀️",
  "🧑‍🤝‍🧑",
  "👥",
  "🎊",
  "🎉",
  "🏆",
  "🥇",
  "🥈",
  "🥉",
  "🏅",
];

// Emoji animation configuration
const EMOJI_SIZE = 32;
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
  endX: number;
  endY: number;
  index: number;
  onComplete: () => void;
}

export const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  emoji,
  startX,
  startY,
  endX,
  endY,
  index,
  onComplete,
}) => {
  // Animation values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(Math.random() * 20 - 10); // Subtle initial rotation
  const positionX = useSharedValue(startX);
  const positionY = useSharedValue(startY);

  // Function to call when animation completes
  const handleAnimationComplete = () => {
    onComplete();
  };

  useEffect(() => {
    // Use a more consistent staggered delay with less randomness
    // This ensures more predictable distribution timing
    const staggerDelay = index * 50;

    // Scale animation: start at normal size and only scale down at destination
    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        staggerDelay,
        withSequence(
          withTiming(1.0, {
            // Start at normal size
            duration: 400,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0.9, {
            // Slight scale down as it travels
            duration: ANIMATION_DURATION - 950,
          }),
          // Wait until fully arrived at destination before decompression
          withTiming(0.9, { duration: 50 }), // Small pause at destination
          withTiming(0.7, {
            // Compress down on arrival (depression)
            duration: 150,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0.85, {
            // Decompress to final size (but still smaller than original)
            duration: 250,
            easing: Easing.inOut(Easing.cubic),
          })
        )
      )
    );

    // Opacity animation: fade in, hold longer, and fade out after decompression is complete
    opacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(staggerDelay, withTiming(1, { duration: 300 })),
      withDelay(
        ANIMATION_DURATION - 450, // Wait for the decompression animation to complete
        withTiming(0, { duration: 450 }, () => {
          runOnJS(handleAnimationComplete)();
        })
      )
    );

    // Generate a slightly curved path using bezier curves to make the movement more organic
    // Each emoji now follows a unique path to its destination
    const controlPointOffsetX = (Math.random() * 2 - 1) * 100; // Random horizontal offset between -100 and 100

    // Position animation: improved path with controlled bezier curve
    // Use longer duration for the movement, but ensure it completes before decompression starts
    const movementDuration = ANIMATION_DURATION - 550; // End movement before decompression

    positionX.value = withDelay(
      staggerDelay,
      withTiming(endX, {
        duration: movementDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );

    // For Y position, create a more natural arc upward
    positionY.value = withDelay(
      staggerDelay,
      withTiming(endY, {
        duration: movementDuration,
        // Different easing creates varied movement patterns
        easing:
          index % 2 === 0
            ? Easing.bezier(0.34, 0.17, 0.65, 0.86)
            : Easing.bezier(0.22, 0.61, 0.36, 1),
      })
    );

    // Subtle rotation animation with more variation
    rotation.value = withDelay(
      staggerDelay,
      withSequence(
        withTiming(rotation.value, { duration: 0 }),
        withSpring(rotation.value + (Math.random() * 40 - 20), {
          damping: 8,
          stiffness: 30,
        })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
      opacity: opacity.value,
      left: positionX.value - EMOJI_SIZE / 2, // Center at the exact point
      top: positionY.value - EMOJI_SIZE / 2,
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
  endX: number;
  endY: number;
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

  useEffect(() => {
    const interval = setInterval(() => {
      const newLocation = getRandomLocation();
      setCurrentLocation(newLocation);

      // Animate to the new location with longer duration
      cameraRef.current?.setCamera({
        centerCoordinate: newLocation.centerCoordinate,
        zoomLevel: newLocation.zoomLevel,
        animationDuration: 4000, // Increased from 2000 to 4000ms
      });

      // Clear existing emission points and active emissions when location changes
      setEmissionPoints([]);
      setActiveEmissions([]);

      // Generate new emission points after a longer delay
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }

      locationChangeTimeoutRef.current = setTimeout(() => {
        generateEmissionPoints();
      }, 1500); // Increased from 500 to 1500ms
    }, locationChangeInterval);

    // Cleanup function for the interval
    return () => {
      clearInterval(interval);
      if (locationChangeTimeoutRef.current) {
        clearTimeout(locationChangeTimeoutRef.current);
      }
    };
  }, [locationChangeInterval]);

  const generateEmissionPoints = () => {
    const newPoints: { x: number; y: number }[] = [];

    // Generate 10-18 random emission points
    const numPoints = 10 + Math.floor(Math.random() * 9);

    // Divide the screen into a grid to ensure better distribution
    const gridCols = 4;
    const gridRows = 3;
    const cellWidth = SCREEN_WIDTH / gridCols;
    const cellHeight = (SCREEN_HEIGHT - 150) / gridRows;

    // Create a grid-based distribution with some randomness
    const cellsToFill = new Set<number>();

    // First, select random cells to fill (ensuring coverage across the screen)
    while (cellsToFill.size < Math.min(gridCols * gridRows, numPoints)) {
      const cellIndex = Math.floor(Math.random() * (gridCols * gridRows));
      cellsToFill.add(cellIndex);
    }

    // For each selected cell, create a point with some random offset within the cell
    Array.from(cellsToFill).forEach((cellIndex: number) => {
      const col = cellIndex % gridCols;
      const row = Math.floor(cellIndex / gridCols);

      // Calculate base position for this cell
      const baseX = col * cellWidth;
      const baseY = row * cellHeight + 50; // Add 50px offset from the top

      // Add a point with random offset within the cell (keeping away from edges)
      const padding = 20;
      const x = baseX + padding + Math.random() * (cellWidth - padding * 2);
      const y = baseY + padding + Math.random() * (cellHeight - padding * 2);

      newPoints.push({ x, y });
    });

    // If we need more points than grid cells, add additional cluster points
    if (numPoints > cellsToFill.size) {
      const additionalPoints = numPoints - cellsToFill.size;

      for (let i = 0; i < additionalPoints; i++) {
        if (newPoints.length > 0 && Math.random() < 0.7) {
          // Create a cluster around an existing point
          const referencePoint = newPoints[Math.floor(Math.random() * newPoints.length)];
          const spread = 60 + Math.random() * 80; // Smaller cluster spread radius

          let x = referencePoint.x + (Math.random() * spread * 2 - spread);
          let y = referencePoint.y + (Math.random() * spread * 2 - spread);

          // Keep within screen bounds
          x = Math.max(20, Math.min(SCREEN_WIDTH - 20, x));
          y = Math.max(50, Math.min(SCREEN_HEIGHT - 150, y));

          newPoints.push({ x, y });
        } else {
          // Create another random point in a random cell
          const col = Math.floor(Math.random() * gridCols);
          const row = Math.floor(Math.random() * gridRows);

          const baseX = col * cellWidth;
          const baseY = row * cellHeight + 50;

          const padding = 20;
          const x = baseX + padding + Math.random() * (cellWidth - padding * 2);
          const y = baseY + padding + Math.random() * (cellHeight - padding * 2);

          newPoints.push({ x, y });
        }
      }
    }

    setEmissionPoints(newPoints);
  };

  // Also update the generateEmission function to better manage emission flow
  const generateEmission = () => {
    if (activeEmissions.length >= MAX_ACTIVE_EMOJIS || emissionPoints.length === 0) return;

    const id = `emoji-${emissionCount.current++}`;
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    // Pick a random emission point that's not already targeted
    const availablePoints = emissionPoints.filter((point) => {
      // Check if this point is already a destination for an active emission
      return !activeEmissions.some(
        (emission) =>
          Math.abs(emission.endX - point.x) < 10 && Math.abs(emission.endY - point.y) < 10
      );
    });

    // If all points are targeted, fall back to a random point
    const emissionPoint =
      availablePoints.length > 0
        ? availablePoints[Math.floor(Math.random() * availablePoints.length)]
        : emissionPoints[Math.floor(Math.random() * emissionPoints.length)];

    // Generate a starting point that's more distributed across the bottom
    // Divide the bottom edge into segments to ensure better horizontal distribution
    const segments = 8;
    const segmentWidth = SCREEN_WIDTH / segments;
    const segmentIndex = Math.floor(Math.random() * segments);
    const startX = segmentIndex * segmentWidth + Math.random() * segmentWidth;
    const startY = SCREEN_HEIGHT + 20; // Start below the screen

    setActiveEmissions((prev) => [
      ...prev,
      {
        id,
        emoji: randomEmoji,
        startX,
        startY,
        endX: emissionPoint.x,
        endY: emissionPoint.y,
        index: prev.length,
      },
    ]);
  };
  useEffect(() => {
    generateEmissionPoints();
  }, []);

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

  const onMapLoaded = () => {
    // Generate new emission points once map is ready
    if (mapLoadedTimeoutRef.current) {
      clearTimeout(mapLoadedTimeoutRef.current);
    }

    mapLoadedTimeoutRef.current = setTimeout(generateEmissionPoints, 1000); // Increased from 500 to 1000ms
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

      {/* Render static markers at emission points */}
      {emissionPoints.map((point, index) => (
        <View
          key={`marker-${index}`}
          style={[
            styles.mapMarker,
            {
              opacity: 0,
              left: point.x - 6, // Center the marker (half of the marker size)
              top: point.y - 6,
            },
          ]}
        />
      ))}

      {/* Render active emoji animations */}
      {activeEmissions.map((emission) => (
        <AnimatedEmoji
          key={emission.id}
          emoji={emission.emoji}
          startX={emission.startX}
          startY={emission.startY}
          endX={emission.endX}
          endY={emission.endY}
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
