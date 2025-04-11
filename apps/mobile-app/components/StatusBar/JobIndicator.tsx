import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
    cancelAnimation,
    withDelay,
} from 'react-native-reanimated';
import { Cog, Check, X } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import CircularProgress from './CircularProgress';

const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const SPIN_CONFIG = {
    duration: 2000,
    easing: Easing.linear,
};

type IndicatorState = 'idle' | 'processing' | 'jobMessage';

const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const spinRotation = useSharedValue(0);
    const [state, setState] = useState<IndicatorState>('idle');
    const [jobMessage, setJobMessage] = useState<{ emoji: string; message: string } | null>(null);
    const previousProgress = useRef(0);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const glowOpacity = useSharedValue(0);
    const xScale = useSharedValue(0);
    const xRotation = useSharedValue(0);
    const animationRefs = useRef<{
        spin?: Animated.SharedValue<number>;
        glow?: Animated.SharedValue<number>;
        xScale?: Animated.SharedValue<number>;
        xRotation?: Animated.SharedValue<number>;
    }>({});

    // Get active jobs with memoization
    const activeJobs = useMemo(() => {
        return jobs.filter(job =>
            job.status === "processing" ||
            job.status === "pending"
        );
    }, [jobs]);

    // Calculate progress with memoization
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

    // Cleanup all animations
    const cleanupAllAnimations = useCallback(() => {
        if (animationRefs.current.spin) {
            cancelAnimation(animationRefs.current.spin);
        }
        if (animationRefs.current.glow) {
            cancelAnimation(animationRefs.current.glow);
        }
        if (animationRefs.current.xScale) {
            cancelAnimation(animationRefs.current.xScale);
        }
        if (animationRefs.current.xRotation) {
            cancelAnimation(animationRefs.current.xRotation);
        }
    }, []);

    // Update state based on active jobs with cleanup
    useEffect(() => {
        const activeJob = activeJobs[0];

        if (activeJobs.length > 0) {
            cleanupAllAnimations();
            setState('processing');
        } else if (state === 'processing') {
            cleanupAllAnimations();
            const isSuccess = activeJob?.status === 'completed';
            setJobMessage({
                emoji: isSuccess ? "✅" : "❌",
                message: isSuccess ? "Completed" : "Failed"
            });
            setState('jobMessage');

            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout
            timeoutRef.current = setTimeout(() => {
                cleanupAllAnimations();
                setState('idle');
                setJobMessage(null);
            }, 3000);
        }

        return () => {
            cleanupAllAnimations();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [activeJobs, state, cleanupAllAnimations]);

    // Setup continuous spinning animation with cleanup
    useEffect(() => {
        if (state === 'processing') {
            animationRefs.current.spin = spinRotation;
            spinRotation.value = withRepeat(
                withTiming(360, SPIN_CONFIG),
                -1,
                false
            );
        } else {
            if (animationRefs.current.spin) {
                cancelAnimation(animationRefs.current.spin);
                animationRefs.current.spin = undefined;
            }
            spinRotation.value = 0;
        }

        return () => {
            if (animationRefs.current.spin) {
                cancelAnimation(animationRefs.current.spin);
                animationRefs.current.spin = undefined;
            }
        };
    }, [state]);

    // Setup failure state animations with cleanup
    useEffect(() => {
        if (state === 'jobMessage' && jobMessage?.emoji === "❌") {
            // Reset values
            glowOpacity.value = 0;
            xScale.value = 0;
            xRotation.value = 0;

            // Store refs
            animationRefs.current.glow = glowOpacity;
            animationRefs.current.xScale = xScale;
            animationRefs.current.xRotation = xRotation;

            // Start animations
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.3, { duration: 1000 }),
                    withTiming(0, { duration: 1000 })
                ),
                -1,
                true
            );

            xScale.value = withSequence(
                withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(1.7)) }),
                withTiming(1, { duration: 100 })
            );

            xRotation.value = withSequence(
                withTiming(-10, { duration: 100 }),
                withTiming(10, { duration: 100 }),
                withTiming(0, { duration: 100 })
            );
        } else {
            cleanupAllAnimations();
            glowOpacity.value = 0;
            xScale.value = 0;
            xRotation.value = 0;
        }

        return () => {
            cleanupAllAnimations();
        };
    }, [state, jobMessage, cleanupAllAnimations]);

    const handlePress = useMemo(() => () => {
        // Cancel any ongoing animations before starting new ones
        cancelAnimation(scale);
        cancelAnimation(rotation);
        cancelAnimation(spinRotation);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.9, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );
    }, []);

    // Cleanup animations and timeouts on unmount
    useEffect(() => {
        return () => {
            cancelAnimation(scale);
            cancelAnimation(rotation);
            cancelAnimation(spinRotation);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

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

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const xStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: xScale.value },
            { rotate: `${xRotation.value}deg` }
        ],
    }));

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.fixedContainer}>
                    {state === 'processing' ? (

                        <View style={styles.placeholderContainer}>
                            <Animated.View
                                entering={FadeIn
                                    .duration(300)
                                    .springify()
                                    .damping(15)
                                    .stiffness(200)}
                                exiting={FadeOut
                                    .duration(300)
                                    .springify()
                                    .damping(15)
                                    .stiffness(200)}
                                style={styles.indicatorWrapper}
                            >
                                <Animated.View style={spinAnimatedStyle}>
                                    <Animated.View
                                        entering={FadeIn
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                        exiting={FadeOut
                                            .duration(300)
                                            .springify()
                                            .damping(15)
                                            .stiffness(200)}
                                    >
                                        <Cog size={10} color="#9CA3AF" />
                                    </Animated.View>
                                </Animated.View>
                            </Animated.View>
                        </View>
                    ) : (
                        <View style={styles.placeholderContainer}>
                            {state === 'jobMessage' && (
                                <Animated.View
                                    entering={FadeIn
                                        .duration(300)
                                        .springify()
                                        .damping(15)
                                        .stiffness(200)}
                                    exiting={FadeOut
                                        .duration(300)
                                        .springify()
                                        .damping(15)
                                        .stiffness(200)}
                                    style={styles.indicatorWrapper}
                                >
                                    {jobMessage?.emoji === "✅" ? (
                                        <Check size={10} color="#4CAF50" />
                                    ) : (
                                        <>
                                            <Animated.View style={[styles.glow, glowStyle]} />
                                            <Animated.View style={xStyle}>
                                                <X size={10} color="#F44336" />
                                            </Animated.View>
                                        </>
                                    )}
                                </Animated.View>
                            )}
                        </View>
                    )}
                </View>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.percentageContainer}
                >
                    <Text style={styles.percentageText}>{progress}%</Text>
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        width: 65,
        padding: 8,
        margin: -8,
        position: 'relative',
    },
    fixedContainer: {
        width: 24,
        height: 24,
        position: 'relative',
    },
    placeholderContainer: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: 1,
        left: 1,
    },
    indicatorWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    percentageContainer: {
        marginLeft: 4,
    },
    percentageText: {
        fontSize: 11,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#9CA3AF',
        letterSpacing: 0.1,
    },
    glow: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F44336',
        opacity: 0.3,
    },
});

export default React.memo(JobIndicator);