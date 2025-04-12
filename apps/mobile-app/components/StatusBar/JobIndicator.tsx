import React, { useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
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
    SharedValue,
} from 'react-native-reanimated';
import { Cog, Check, X } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore } from "@/stores/useJobSessionStore";

// Constants moved outside component to prevent recreation
const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const SPIN_CONFIG = {
    duration: 2000,
    easing: Easing.linear,
};

// Define state types
type IndicatorState = 'idle' | 'processing' | 'jobMessage';

interface IndicatorStateInterface {
    state: IndicatorState;
    jobMessage: { emoji: string; message: string } | null;
}

// Define action types
type ActionType =
    | { type: 'SET_STATE', payload: IndicatorState }
    | { type: 'SET_JOB_MESSAGE', payload: { emoji: string; message: string } | null }
    | { type: 'RESET' };

// Initial state
const initialState: IndicatorStateInterface = {
    state: 'idle',
    jobMessage: null
};

// Reducer function for consolidated state management
const indicatorReducer = (state: IndicatorStateInterface, action: ActionType): IndicatorStateInterface => {
    switch (action.type) {
        case 'SET_STATE':
            return { ...state, state: action.payload };
        case 'SET_JOB_MESSAGE':
            return { ...state, jobMessage: action.payload };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
};

const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const [{ state, jobMessage }, dispatch] = useReducer(indicatorReducer, initialState);
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Animation values
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const spinRotation = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const xScale = useSharedValue(0);
    const xRotation = useSharedValue(0);

    // Animation registry for proper tracking and cleanup
    const animationRegistry = useRef(new Set<SharedValue<number>>()).current;

    // Register animation for tracking
    const registerAnimation = useCallback((animation: SharedValue<number>) => {
        animationRegistry.add(animation);
    }, []);

    // Cancel all tracked animations
    const cancelAllAnimations = useCallback(() => {
        animationRegistry.forEach(animation => {
            cancelAnimation(animation);
            animation.value = 0;
        });
        animationRegistry.clear();
    }, []);

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

    // Centralized function to start a timeout with auto-cleanup
    const startTimeout = useCallback((callback: () => void, delay: number) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback();
            timeoutRef.current = undefined;
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
        };
    }, []);

    // Update state based on active jobs
    useEffect(() => {
        if (activeJobs.length > 0) {
            cancelAllAnimations();
            dispatch({ type: 'SET_STATE', payload: 'processing' });
        } else if (state === 'processing') {
            cancelAllAnimations();

            // Find the latest job that completed or failed
            const lastJob = jobs.find(job =>
                job.status === 'completed' || job.status === 'failed'
            );

            if (lastJob) {
                const isSuccess = lastJob.status === 'completed';
                dispatch({
                    type: 'SET_JOB_MESSAGE',
                    payload: {
                        emoji: isSuccess ? "✅" : "❌",
                        message: isSuccess ? "Completed" : "Failed"
                    }
                });
                dispatch({ type: 'SET_STATE', payload: 'jobMessage' });

                // Auto-reset after delay with cleanup
                const cleanup = startTimeout(() => {
                    cancelAllAnimations();
                    dispatch({ type: 'RESET' });
                }, 3000);

                return cleanup;
            }
        }
    }, [activeJobs, jobs, state, cancelAllAnimations, startTimeout]);

    // Setup animations based on state
    useEffect(() => {
        // Clear previous animations first
        cancelAllAnimations();

        if (state === 'processing') {
            spinRotation.value = withRepeat(
                withTiming(360, SPIN_CONFIG),
                -1,
                false
            );
            registerAnimation(spinRotation);
        }
        else if (state === 'jobMessage' && jobMessage?.emoji === "❌") {
            // Reset values
            glowOpacity.value = 0;
            xScale.value = 0;
            xRotation.value = 0;

            // Start animations for failure state
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.3, { duration: 1000 }),
                    withTiming(0, { duration: 1000 })
                ),
                -1,
                true
            );
            registerAnimation(glowOpacity);

            xScale.value = withSequence(
                withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(1.7)) }),
                withTiming(1, { duration: 100 })
            );
            registerAnimation(xScale);

            xRotation.value = withSequence(
                withTiming(-10, { duration: 100 }),
                withTiming(10, { duration: 100 }),
                withTiming(0, { duration: 100 })
            );
            registerAnimation(xRotation);
        }

        return () => {
            cancelAllAnimations();
        };
    }, [state, jobMessage, registerAnimation, cancelAllAnimations]);

    // Handle press with proper dependencies
    const handlePress = useCallback(() => {
        cancelAnimation(scale);
        cancelAnimation(rotation);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        scale.value = withSequence(
            withSpring(0.9, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );
        registerAnimation(scale);
    }, [scale, registerAnimation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancelAllAnimations();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [cancelAllAnimations]);

    // Animated styles
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