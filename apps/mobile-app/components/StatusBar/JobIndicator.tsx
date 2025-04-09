import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    withRepeat,
    Easing,
    FadeIn,
    FadeOut,
    SlideInRight,
    withDelay,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';
import { Cog, ArrowRight, AlertCircle } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, DiscoveredEventData, DiscoveryEvent, EventTypes } from "@/services/EventBroker";

type IndicatorState = 'idle' | 'processing' | 'discovered';

export const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const { subscribe, publish } = useEventBroker();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const spinRotation = useSharedValue(0);
    const bounceValue = useSharedValue(0);
    const [state, setState] = React.useState<IndicatorState>('idle');
    const [discoveryData, setDiscoveryData] = React.useState<DiscoveredEventData | null>(null);

    // Get active jobs
    const activeJobs = useMemo(() => {
        return jobs.filter(job =>
            job.status === "processing" ||
            job.status === "pending"
        );
    }, [jobs]);

    // Calculate progress
    const progress = useMemo(() => {
        if (activeJobs.length === 0) return 0;

        const totalProgress = activeJobs.reduce((sum, job) => {
            if (typeof job.progress === 'number') {
                return sum + job.progress;
            }
            return sum;
        }, 0);

        return Math.round((totalProgress / activeJobs.length));
    }, [activeJobs]);



    // Subscribe to discovery events
    useEffect(() => {
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event: DiscoveryEvent) => {
            setDiscoveryData(event.event);
            setState('discovered');

            // Animate the bounce
            bounceValue.value = withSequence(
                withSpring(1.2, { damping: 8, stiffness: 200 }),
                withSpring(1, { damping: 8, stiffness: 200 })
            );

            // Auto-reset after 10 seconds
            setTimeout(() => {
                setState('idle');
                setDiscoveryData(null);
            }, 10000);
        });

        return () => unsubscribe();
    }, [subscribe]);

    // Update state based on jobs
    useEffect(() => {
        if (state === 'discovered') return; // Don't override discovery state

        if (activeJobs.length > 0) {
            setState('processing');
        } else {
            setState('idle');
        }
    }, [activeJobs.length, state]);

    // Setup continuous spinning animation
    useEffect(() => {
        if (state === 'processing') {
            spinRotation.value = withRepeat(
                withTiming(360, {
                    duration: 2000,
                    easing: Easing.linear,
                }),
                -1,
                false
            );
        } else {
            spinRotation.value = 0;
        }
    }, [state]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (state === 'discovered' && discoveryData?.location?.coordinates) {
            // Fly to discovered location
            publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
                coordinates: discoveryData.location.coordinates,
                timestamp: Date.now(),
                source: "job_indicator"
            });

            // Reset state after flying
            setTimeout(() => {
                setState('idle');
                setDiscoveryData(null);
            }, 1000);
        } else {
            // Regular press animation
            scale.value = withSequence(
                withSpring(0.95, { damping: 10, stiffness: 200 }),
                withSpring(1, { damping: 10, stiffness: 200 })
            );
            rotation.value = withSequence(
                withTiming(-5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
                withTiming(5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) })
            );
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ],
    }));

    const spinAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${spinRotation.value}deg` }
        ],
    }));

    const bounceAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: bounceValue.value }
        ],
    }));

    // Don't render in idle state
    if (state === 'idle') return null;

    return (
        <Animated.View
            entering={SlideInRight.springify().damping(15).mass(1).stiffness(200)}
            style={styles.container}
        >
            <Pressable onPress={handlePress}>
                <Animated.View style={[
                    styles.iconContainer,
                    state === 'discovered' && styles.discoveryContainer,
                    state === 'discovered' && bounceAnimatedStyle
                ]}>
                    <Animated.View style={[
                        animatedStyle,
                        state === 'processing' ? spinAnimatedStyle : undefined
                    ]}>
                        {state === 'processing' ? (
                            <Cog size={12} color="#FF6B00" />
                        ) : state === 'discovered' ? (
                            <Animated.View
                                entering={FadeIn.duration(300).springify()}
                                exiting={FadeOut.duration(200)}
                                style={styles.discoveryContent}
                            >
                                <Animated.Text
                                    entering={ZoomIn.springify().damping(15).mass(1).stiffness(200)}
                                    exiting={ZoomOut.duration(200)}
                                    style={styles.emojiText}
                                >
                                    {discoveryData?.emoji || "✨"}
                                </Animated.Text>
                                <Animated.View
                                    entering={FadeIn.delay(100).duration(200)}
                                    exiting={FadeOut.duration(150)}
                                    style={styles.exclamationContainer}
                                >
                                    <Text style={styles.exclamationText}>!</Text>
                                </Animated.View>
                            </Animated.View>
                        ) : null}
                    </Animated.View>
                </Animated.View>
            </Pressable>
            {state === 'processing' && (
                <Text style={styles.text}>
                    {progress}%
                </Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iconContainer: {
        width: 24, // Increased from 20
        height: 24, // Increased from 20
        borderRadius: 12, // Adjusted for new size
        backgroundColor: 'rgba(255, 107, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    discoveryContainer: {
        backgroundColor: 'rgba(75, 85, 99, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#FF6B00',
        letterSpacing: 0.2,
    },
    discoveryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    emojiText: {
        fontSize: 14, // Increased from 12
        color: '#FFFFFF',
    },
    exclamationContainer: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FCD34D', // Bright yellow background
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.2)', // Subtle black border
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    exclamationText: {
        fontSize: 7,
        fontWeight: '900', // Made bolder
        color: '#000000', // Pure black
        textAlign: 'center',
        lineHeight: 10,
    },
}); 