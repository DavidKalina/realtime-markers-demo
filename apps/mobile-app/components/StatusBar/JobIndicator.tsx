import React, { useEffect, useMemo, useState } from 'react';
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
    ZoomIn,
    ZoomOut,
    runOnJS,
    SlideOutLeft,
} from 'react-native-reanimated';
import { Cog, AlertCircle } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, DiscoveredEventData, DiscoveryEvent, EventTypes } from "@/services/EventBroker";
import CircularProgress from './CircularProgress'; // Import the SVG-based circular progress

type IndicatorState = 'idle' | 'processing' | 'discovered';

export const JobIndicator = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const { subscribe, publish } = useEventBroker();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const spinRotation = useSharedValue(0);
    const [state, setState] = useState<IndicatorState>('idle');
    const [discoveryData, setDiscoveryData] = useState<DiscoveredEventData | null>(null);

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
        console.log('Setting up discovery event subscription...');
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event: DiscoveryEvent) => {
            console.log('Discovery event received:', event);
            setDiscoveryData(event.event);
            setState('discovered');

            // Add haptic feedback
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            // Auto-reset after 15 seconds
            setTimeout(() => {
                console.log('Resetting from discovered state...');
                setState('idle');
                setDiscoveryData(null);
            }, 15000);
        });

        return () => {
            console.log('Cleaning up discovery event subscription...');
            unsubscribe();
        };
    }, [subscribe]);

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

        // Animate press compression
        scale.value = withSequence(
            withSpring(0.9, { damping: 10, stiffness: 200 }),
            withSpring(1, { damping: 10, stiffness: 200 })
        );

        // Handle camera movement after animation completes
        if (state === 'discovered' && discoveryData?.location?.coordinates) {
            publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
                coordinates: discoveryData.location.coordinates,
                timestamp: Date.now(),
                source: "job_indicator"
            });
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

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Animated.View style={[styles.container, animatedStyle]}>
                {state === 'idle' && (
                    <View style={[styles.iconContainer, styles.placeholderContainer]} />
                )}
                {(state === 'processing' || state === 'discovered') && (
                    <Animated.View
                        entering={SlideInRight
                            .duration(300)
                            .springify()
                            .damping(15)
                            .stiffness(200)}
                        exiting={SlideOutLeft
                            .duration(300)
                            .springify()
                            .damping(15)
                            .stiffness(200)}
                        style={styles.indicatorWrapper}
                    >
                        {state === 'processing' && <CircularProgress progress={progress} />}
                        <Animated.View style={[
                            styles.iconContainer,
                            state === 'discovered' && styles.discoveryContainer
                        ]}>
                            <Animated.View style={[
                                state === 'processing' ? spinAnimatedStyle : undefined
                            ]}>
                                {state === 'processing' && (
                                    <Animated.View
                                        entering={ZoomIn
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                        exiting={ZoomOut
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                    >
                                        <Cog size={10} color="#FF6B00" />
                                    </Animated.View>
                                )}
                                {state === 'discovered' && (
                                    <Animated.View
                                        entering={ZoomIn
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                        exiting={ZoomOut
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                        style={styles.discoveryContent}
                                    >
                                        <Animated.Text
                                            entering={FadeIn
                                                .duration(500)
                                                .springify()
                                                .damping(15)
                                                .stiffness(200)}
                                            exiting={FadeOut.duration(300)}
                                            style={styles.emojiText}
                                        >
                                            {discoveryData?.emoji || "✨"}
                                        </Animated.Text>
                                        <Animated.View
                                            entering={FadeIn
                                                .delay(200)
                                                .duration(300)
                                                .springify()
                                                .damping(15)
                                                .stiffness(200)}
                                            exiting={FadeOut.duration(200)}
                                            style={styles.exclamationContainer}
                                        >
                                            <Text style={styles.exclamationText}>!</Text>
                                        </Animated.View>
                                    </Animated.View>
                                )}
                            </Animated.View>
                        </Animated.View>
                    </Animated.View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        margin: -8,
    },
    iconContainer: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 107, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderContainer: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    discoveryContainer: {
        backgroundColor: 'rgba(75, 85, 99, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(107, 114, 128, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
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
        fontSize: 12,
        color: '#FFFFFF',
    },
    exclamationContainer: {
        position: 'absolute',
        top: -5,
        right: -5,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FCD34D',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    exclamationText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#000000',
        textAlign: 'center',
        lineHeight: 10,
    },
    indicatorWrapper: {
        position: 'relative',
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});