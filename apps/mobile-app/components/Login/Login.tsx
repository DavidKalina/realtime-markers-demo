import { useAuth } from "@/contexts/AuthContext";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  spring,
} from "@/theme";
import { useAppActive } from "@/hooks/useAppActive";
import { useFlyOverCamera } from "@/hooks/useFlyOverCamera";
import {
  MarkerSVG,
  MARKER_WIDTH,
  MARKER_HEIGHT,
} from "@/components/Markers/MarkerSVGs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  BounceIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import MapboxGL from "@rnmapbox/maps";
import AppHeader from "../AnimationHeader";
import Input from "../Input/Input";

// Set access token at module scope (login renders before home screen)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN!);

// Flyover center: NYC / Empire State Building area
const FLYOVER_CENTER: [number, number] = [-73.9857, 40.7484];

// Simulated event markers scattered around the flyover center
const SIMULATED_MARKERS: {
  id: string;
  emoji: string;
  title: string;
  coordinate: [number, number];
}[] = [
  {
    id: "m1",
    emoji: "🎵",
    title: "Jazz Night",
    coordinate: [-73.9877, 40.7504],
  },
  { id: "m2", emoji: "🎨", title: "Art Walk", coordinate: [-73.9837, 40.7464] },
  {
    id: "m3",
    emoji: "🍕",
    title: "Food Fest",
    coordinate: [-73.9897, 40.7474],
  },
  {
    id: "m4",
    emoji: "🎭",
    title: "Comedy Show",
    coordinate: [-73.9827, 40.7514],
  },
  {
    id: "m5",
    emoji: "🎸",
    title: "Live Music",
    coordinate: [-73.9867, 40.7444],
  },
  {
    id: "m6",
    emoji: "📸",
    title: "Photo Tour",
    coordinate: [-73.9817, 40.7494],
  },
  {
    id: "m7",
    emoji: "🍷",
    title: "Wine Tasting",
    coordinate: [-73.9907, 40.7454],
  },
  {
    id: "m8",
    emoji: "🧘",
    title: "Yoga Class",
    coordinate: [-73.9847, 40.7524],
  },
  {
    id: "m9",
    emoji: "🎪",
    title: "Street Fair",
    coordinate: [-73.9887, 40.7434],
  },
  { id: "m10", emoji: "🏃", title: "Fun Run", coordinate: [-73.9807, 40.7484] },
];

// Lightweight marker pin — static visual only
const SimulatedMarkerPin: React.FC<{ emoji: string }> = React.memo(
  ({ emoji }) => (
    <View style={markerStyles.pin}>
      <MarkerSVG />
      <View style={markerStyles.emojiContainer}>
        <Text style={markerStyles.emoji}>{emoji}</Text>
      </View>
    </View>
  ),
);

const markerStyles = StyleSheet.create({
  pin: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiContainer: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  emoji: {
    fontSize: 18,
    textAlign: "center",
  },
});

// Gradient overlay component
const GradientOverlay: React.FC = React.memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="black" stopOpacity="0.3" />
          <Stop offset="0.5" stopColor="black" stopOpacity="0.5" />
          <Stop offset="1" stopColor="black" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
    </Svg>
  </View>
));

const Login: React.FC = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  // Map and camera refs
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { flyOver, stopFlyOver } = useFlyOverCamera({
    cameraRef: cameraRef as React.RefObject<MapboxGL.Camera>,
  });

  // Deferred map mount — mounting MapboxGL.MapView while reanimated entering
  // animations are in-flight causes a deadlock on the ComponentDescriptorRegistry
  // mutex. Same two-tier pattern as app/index.tsx: wait for the screen transition
  // to finish (or a fallback timeout), then defer one more frame.
  // See: https://github.com/facebook/react-native/issues/53128
  const navigation = useNavigation();
  const [isMapMounted, setIsMapMounted] = useState(false);
  const isAppActive = useAppActive();
  const mapHasMountedOnce = useRef(false);

  useEffect(() => {
    let mounted = false;
    const mount = () => {
      if (!mounted) {
        mounted = true;
        requestAnimationFrame(() => {
          mapHasMountedOnce.current = true;
          setIsMapMounted(true);
        });
      }
    };

    const unsubscribe = navigation.addListener("transitionEnd", mount);
    // Fallback for the initial screen if no transition animation fires
    const fallbackId = setTimeout(mount, 600);

    return () => {
      unsubscribe();
      clearTimeout(fallbackId);
    };
  }, [navigation]);

  // Simulated markers — start with 3, add one every ~2.5 seconds
  const [visibleMarkerCount, setVisibleMarkerCount] = useState(3);
  useEffect(() => {
    if (visibleMarkerCount >= SIMULATED_MARKERS.length) return;
    const interval = setInterval(() => {
      setVisibleMarkerCount((prev) => {
        if (prev >= SIMULATED_MARKERS.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [visibleMarkerCount]);

  const handleMapLoaded = useCallback(() => {
    if (!isMounted.current) return;
    flyOver(FLYOVER_CENTER, {
      speed: 0.3,
      minZoom: 14.5,
      maxZoom: 16.5,
    });
  }, [flyOver]);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      stopFlyOver();
    };
  }, [stopFlyOver]);

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setError("Email is required");
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      setError("Password is required");
      passwordInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await login(email, password);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Login error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to login. Please check your credentials and try again.",
      );
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    Haptics.selectionAsync();
    router.push("/register");
  };

  const handleLoginPress = async () => {
    if (isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    buttonScale.value = withSequence(
      withSpring(0.95, spring.press),
      withSpring(1, spring.press),
    );

    setTimeout(() => {
      Keyboard.dismiss();
      handleLogin();
    }, 150);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.fixed.black}
      />

      {/* Layer 1: Map background */}
      {isMapMounted && isAppActive && (
        <MapboxGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL={MapboxGL.StyleURL.Dark}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onDidFinishLoadingMap={handleMapLoaded}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: FLYOVER_CENTER,
              zoomLevel: 15,
              pitch: 50,
            }}
          />
          {SIMULATED_MARKERS.slice(0, visibleMarkerCount).map((marker) => (
            <MapboxGL.MarkerView
              key={marker.id}
              coordinate={marker.coordinate}
              allowOverlap
            >
              <Animated.View entering={BounceIn.duration(600)}>
                <SimulatedMarkerPin emoji={marker.emoji} />
              </Animated.View>
            </MapboxGL.MarkerView>
          ))}
        </MapboxGL.MapView>
      )}

      {/* Layer 2: Gradient overlay */}
      <GradientOverlay />

      {/* Layer 3: Foreground content */}
      <SafeAreaView style={styles.foreground}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          {/* Header area — flex: 1 compresses when keyboard opens */}
          <View style={styles.headerArea}>
            <AppHeader />
          </View>

          {/* Form card — anchored at bottom */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(300).springify()}
            style={styles.formWrapper}
          >
            <BlurView intensity={40} tint="dark" style={styles.formCard}>
              {/* Android fallback: semi-transparent background */}
              {Platform.OS === "android" && (
                <View style={styles.androidBlurFallback} />
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={{ gap: spacing.lg }}>
                <Input
                  ref={emailInputRef}
                  icon={Mail}
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  delay={300}
                />

                <Input
                  ref={passwordInputRef}
                  icon={Lock}
                  rightIcon={showPassword ? EyeOff : Eye}
                  onRightIconPress={togglePasswordVisibility}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  delay={400}
                />

                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/forgot-password");
                  }}
                  style={styles.forgotPasswordContainer}
                >
                  <Text style={styles.forgotPasswordText}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.loginButtonContainer}>
                <Animated.View style={buttonAnimatedStyle}>
                  <TouchableOpacity
                    onPress={handleLoginPress}
                    disabled={isLoading}
                    activeOpacity={0.7}
                    style={styles.loginButton}
                  >
                    {isLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.text.primary}
                      />
                    ) : (
                      <Text style={styles.loginButtonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>
                  Don't have an account?{" "}
                </Text>
                <TouchableOpacity onPress={handleCreateAccount}>
                  <Text style={styles.createAccountLink}>Create one</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Bottom spacer */}
          <View style={styles.bottomSpacer} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fixed.black,
  },

  foreground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  headerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  formWrapper: {
    paddingHorizontal: spacing.xl,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  formCard: {
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },

  androidBlurFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(42, 42, 42, 0.85)",
  },

  errorContainer: {
    backgroundColor: colors.status.error.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.status.error.border,
  },

  errorText: {
    color: colors.status.error.text,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },

  loginButton: {
    borderRadius: radius.md,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.accent.muted,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },

  loginButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },

  loginButtonContainer: {
    marginTop: spacing.xl,
  },

  createAccountContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.lg,
  },

  createAccountText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
  },

  createAccountLink: {
    color: colors.accent.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },

  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },

  forgotPasswordText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
  },

  bottomSpacer: {
    height: spacing.lg,
  },
});

export default Login;
