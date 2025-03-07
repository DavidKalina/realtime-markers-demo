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
];

// Emoji animation configuration
const EMOJI_SIZE = 18;
const EMISSION_INTERVAL = 1000; // ms between emoji emissions (slightly faster for twinkling)
const MAX_ACTIVE_EMOJIS = 8; // Increased for better twinkling effect across the map
const ANIMATION_DURATION = 5000; // ms (longer for prettier twinkling)
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// Camera configuration
const CAMERA_UPDATE_INTERVAL = 16; // ms (approximately 60fps for smoother animation)
const PITCH = 50; // Fixed pitch for 3D effect
const BEARING_CHANGE_SPEED = 0.03; // Degrees per update - slower rotation for smoother effect
const PAN_SPEED = 0.00015; // Speed of position change (in degrees)
const PAN_RADIUS = 0.008; // Maximum distance to pan from center point

// Default map settings
const DEFAULT_LOCATION = {
  center: [-122.4324, 37.78825], // San Francisco by default
  zoom: 14,
  styleURL: Mapbox.StyleURL.Dark,
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
    // Use a consistent staggered delay
    const staggerDelay = index * 100;

    // For the twinkling effect
    const twinkleDuration = ANIMATION_DURATION * 0.7; // 70% of total animation time
    const fadeInDuration = 600; // Longer fade-in for prettier twinkling
    const fadeOutDuration = 800; // Longer fade-out for prettier twinkling
    const holdDuration = twinkleDuration - fadeInDuration - fadeOutDuration;

    // Scale animation for twinkling
    scale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        staggerDelay,
        withSequence(
          // Grow from nothing
          withTiming(1.1, {
            duration: fadeInDuration * 0.7,
            easing: Easing.out(Easing.cubic),
          }),
          // Settle to normal size
          withTiming(1.0, {
            duration: fadeInDuration * 0.3,
            easing: Easing.inOut(Easing.cubic),
          }),
          // Hold
          withTiming(1.0, { duration: holdDuration }),
          // Pulse slightly before fading out
          withTiming(1.15, {
            duration: fadeOutDuration * 0.3,
            easing: Easing.out(Easing.cubic),
          }),
          // Shrink away
          withTiming(0, {
            duration: fadeOutDuration * 0.7,
            easing: Easing.in(Easing.cubic),
          })
        )
      )
    );

    // Opacity animation for twinkling
    opacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        staggerDelay,
        withSequence(
          // Fade in
          withTiming(0.9, {
            duration: fadeInDuration,
            easing: Easing.out(Easing.cubic),
          }),
          // Hold
          withTiming(0.9, { duration: holdDuration }),
          // Fade out
          withTiming(
            0,
            {
              duration: fadeOutDuration,
              easing: Easing.in(Easing.cubic),
            },
            () => {
              runOnJS(handleAnimationComplete)();
            }
          )
        )
      )
    );

    // Subtle rotation animation
    rotation.value = withDelay(
      staggerDelay,
      withSequence(
        withTiming(rotation.value, { duration: 0 }),
        withTiming(rotation.value + (Math.random() * 10 - 5), {
          duration: twinkleDuration,
          easing: Easing.inOut(Easing.cubic),
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
  location?: {
    center: [number, number]; // [longitude, latitude]
    zoom: number;
    styleURL: string;
  };
}

const AnimatedMapBackground: React.FC<AnimatedMapBackgroundProps> = ({
  location = DEFAULT_LOCATION,
}) => {
  const [activeEmissions, setActiveEmissions] = useState<AnimatedEmission[]>([]);
  const [emissionPoints, setEmissionPoints] = useState<{ x: number; y: number }[]>([]);

  // Camera state
  const [cameraPosition, setCameraPosition] = useState({
    centerCoordinate: location.center,
    zoomLevel: location.zoom,
    pitch: PITCH,
    bearing: 0,
  });

  // Refs
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const emissionCount = useRef(0);

  // Animation control refs
  const panAnimationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const bearingRef = useRef(0);

  // Create complex panning pattern reference values
  const xOffsetFactorRef = useRef(Math.random() * Math.PI * 2);
  const yOffsetFactorRef = useRef(Math.random() * Math.PI * 2);
  const xFrequencyRef = useRef(0.0001 + Math.random() * 0.0001);
  const yFrequencyRef = useRef(0.0001 + Math.random() * 0.0001);

  // Set up continuous panning viewport
  useEffect(() => {
    // Start with interpolation state
    let currentXOffset = 0;
    let currentYOffset = 0;
    let targetXOffset = 0;
    let targetYOffset = 0;
    let currentBearing = 0;

    // For smoother movement, we'll use interpolation
    const INTERPOLATION_FACTOR = 0.03; // Lower = smoother but slower transitions

    // First update to establish initial position
    cameraRef.current?.setCamera({
      centerCoordinate: location.center,
      zoomLevel: location.zoom,
      pitch: PITCH,
      animationDuration: 0,
    });

    // Generate new targets periodically
    const newTargetIntervalRef = setInterval(() => {
      // Generate new target offsets for complex panning pattern
      // Creates natural-looking movement that's less predictable
      targetXOffset = (Math.random() * 2 - 1) * PAN_RADIUS * 0.7;
      targetYOffset = (Math.random() * 2 - 1) * PAN_RADIUS * 0.7;
    }, 10000); // Change targets every 10 seconds

    // Start the panning animation at high framerate
    panAnimationIntervalRef.current = setInterval(() => {
      // Increment time reference
      timeRef.current += CAMERA_UPDATE_INTERVAL;

      // Update bearing with smooth continuous rotation
      bearingRef.current = (bearingRef.current + BEARING_CHANGE_SPEED) % 360;

      // For silky smooth camera movement, interpolate toward target values
      // This creates gradual acceleration/deceleration between positions
      currentXOffset = currentXOffset + (targetXOffset - currentXOffset) * INTERPOLATION_FACTOR;
      currentYOffset = currentYOffset + (targetYOffset - currentYOffset) * INTERPOLATION_FACTOR;
      currentBearing =
        currentBearing + (bearingRef.current - currentBearing) * INTERPOLATION_FACTOR;

      // Add subtle sinusoidal movement for organic feel - very small amplitude
      const subtleX = Math.sin(timeRef.current * 0.0001) * PAN_RADIUS * 0.1;
      const subtleY = Math.cos(timeRef.current * 0.00008) * PAN_RADIUS * 0.1;

      // Calculate new center position with combined movement patterns
      const newCenter = [
        location.center[0] + currentXOffset + subtleX,
        location.center[1] + currentYOffset + subtleY,
      ];

      // Apply the camera update with very short animation duration for smoothness
      cameraRef.current?.setCamera({
        centerCoordinate: newCenter,
        zoomLevel: location.zoom,
        pitch: PITCH,
        animationDuration: CAMERA_UPDATE_INTERVAL, // Match interval for smooth motion
      });

      // Update state (for other components that might need the position)
      setCameraPosition({
        centerCoordinate: newCenter,
        zoomLevel: location.zoom,
        pitch: PITCH,
        bearing: currentBearing,
      });
    }, CAMERA_UPDATE_INTERVAL);

    // Cleanup
    return () => {
      if (panAnimationIntervalRef.current) {
        clearInterval(panAnimationIntervalRef.current);
      }
      if (newTargetIntervalRef) {
        clearInterval(newTargetIntervalRef);
      }
    };
  }, [location]);

  const generateEmissionPoints = () => {
    const newPoints: { x: number; y: number }[] = [];

    // Generate 15-25 random emission points (more points for better twinkling coverage)
    const numPoints = 15 + Math.floor(Math.random() * 11);

    // Divide the screen into a grid to ensure better distribution
    const gridCols = 5;
    const gridRows = 4;
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
          const spread = 60 + Math.random() * 80; // Cluster spread radius

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

  // Generate emissions that twinkle on the map
  const generateEmission = () => {
    if (activeEmissions.length >= MAX_ACTIVE_EMOJIS || emissionPoints.length === 0) return;

    const id = `emoji-${emissionCount.current++}`;
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    // Pick a random emission point that's not already in use
    const availablePoints = emissionPoints.filter((point) => {
      // Check if this point is already being used by an active emission
      return !activeEmissions.some(
        (emission) =>
          Math.abs(emission.endX - point.x) < 10 && Math.abs(emission.endY - point.y) < 10
      );
    });

    // If all points are in use, fall back to a random point
    const emissionPoint =
      availablePoints.length > 0
        ? availablePoints[Math.floor(Math.random() * availablePoints.length)]
        : emissionPoints[Math.floor(Math.random() * emissionPoints.length)];

    // For twinkling effect, start and end at the same point on the map
    const x = emissionPoint.x;
    const y = emissionPoint.y;

    setActiveEmissions((prev) => [
      ...prev,
      {
        id,
        emoji: randomEmoji,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
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

    // Cleanup function
    return () => {
      if (emissionIntervalRef.current) {
        clearInterval(emissionIntervalRef.current);
      }
    };
  }, [activeEmissions.length, emissionPoints]);

  // Map initialization timeout
  const mapLoadedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMapLoaded = () => {
    // Generate new emission points once map is ready
    if (mapLoadedTimeoutRef.current) {
      clearTimeout(mapLoadedTimeoutRef.current);
    }

    mapLoadedTimeoutRef.current = setTimeout(generateEmissionPoints, 1000);
  };

  // Final cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Clear all timeouts and intervals
      if (panAnimationIntervalRef.current) {
        clearInterval(panAnimationIntervalRef.current);
      }
      if (emissionIntervalRef.current) {
        clearInterval(emissionIntervalRef.current);
      }
      if (mapLoadedTimeoutRef.current) {
        clearTimeout(mapLoadedTimeoutRef.current);
      }

      // Clear state to prevent memory leaks
      setEmissionPoints([]);
      setActiveEmissions([]);

      // Reset counter
      emissionCount.current = 0;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={location.styleURL}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={onMapLoaded}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={cameraPosition.zoomLevel}
          pitch={cameraPosition.pitch}
          centerCoordinate={cameraPosition.centerCoordinate}
          animationMode="easeTo"
          animationDuration={CAMERA_UPDATE_INTERVAL}
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
              left: point.x - 6,
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
    backgroundColor: "rgba(34, 34, 34, 0.88)", // Slightly darker overlay
  },
  emojiContainer: {
    position: "absolute",
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    borderRadius: EMOJI_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(26, 26, 26, 0.7)", // Semi-transparent background for better twinkling
    borderWidth: 1, // Thin border
    borderColor: "#4dabf7", // Tech-blue border
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, // Higher opacity for glow effect
    shadowRadius: 6, // Larger radius for glow effect
    elevation: 3,
    zIndex: 0, // Ensure emojis stay behind login elements
  },
  emoji: {
    fontSize: 6, // Smaller emoji
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
