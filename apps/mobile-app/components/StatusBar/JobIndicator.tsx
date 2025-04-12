import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    FadeIn,
    FadeOut,
    cancelAnimation,
    runOnJS,
} from 'react-native-reanimated';
import { Cog, Check, X } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore, Job } from "@/stores/useJobSessionStore";

// Constants moved outside component to prevent recreation
const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const SPIN_CONFIG = {
    duration: 2000,
    easing: Easing.linear,
};

const TEXT_ANIMATION_CONFIG = {
    duration: 200,
    easing: Easing.out(Easing.cubic),
};

const STATUS_DISPLAY_DURATION = 1500; // How long to display the success/failure state

// Define status types
const STATUS = {
    IDLE: 'idle',
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILURE: 'failure',
};

const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const [displayStatus, setDisplayStatus] = useState(STATUS.IDLE);
    const [lastCompletedJob, setLastCompletedJob] = useState<Job | null>(null);
    const prevJobsRef = useRef(jobs);

    // Shared animation values
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const textScale = useSharedValue(1);
    const textOpacity = useSharedValue(1);
    const iconScale = useSharedValue(0);
    const iconOpacity = useSharedValue(0);

    // Track status changes with status indicator
    const statusBgColor = useSharedValue('rgba(255, 255, 255, 0.05)');
    const statusBorderColor = useSharedValue('rgba(255, 255, 255, 0.1)');

    // Get pending jobs with memoization
    const pendingJobs = useMemo(() => {
        return jobs.filter(job => job.status === "pending" || job.status === "processing");
    }, [jobs]);

    // Get completed and failed jobs
    const completedJobs = useMemo(() => {
        return jobs.filter(job => job.status === "completed");
    }, [jobs]);

    const failedJobs = useMemo(() => {
        return jobs.filter(job => job.status === "failed");
    }, [jobs]);

    // Setup spinning animation when there are pending jobs
    useEffect(() => {
        if (pendingJobs.length > 0 && displayStatus === STATUS.IDLE) {
            rotation.value = withRepeat(
                withTiming(360, SPIN_CONFIG),
                -1,
                false
            );
        } else if (pendingJobs.length === 0 || displayStatus !== STATUS.IDLE) {
            cancelAnimation(rotation);
            rotation.value = 0;
        }

        return () => {
            cancelAnimation(rotation);
        };
    }, [pendingJobs.length, rotation, displayStatus]);

    // Detect job completions or failures
    useEffect(() => {
        // Skip on first render
        if (prevJobsRef.current === jobs) return;

        const prevJobs = prevJobsRef.current;
        prevJobsRef.current = jobs;

        // Find newly completed or failed jobs
        const newlyCompleted = jobs.find(job =>
            job.status === "completed" &&
            !prevJobs.find(prevJob => prevJob.id === job.id && prevJob.status === "completed")
        );

        const newlyFailed = jobs.find(job =>
            job.status === "failed" &&
            !prevJobs.find(prevJob => prevJob.id === job.id && prevJob.status === "failed")
        );

        if (newlyCompleted) {
            setLastCompletedJob(newlyCompleted);
            showSuccessState();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (newlyFailed) {
            setLastCompletedJob(newlyFailed);
            showFailureState();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [jobs]);

    // Animate text when pending jobs count changes
    useEffect(() => {
        if (displayStatus === STATUS.IDLE) {
            textScale.value = withSequence(
                withTiming(1.2, TEXT_ANIMATION_CONFIG),
                withTiming(1, TEXT_ANIMATION_CONFIG)
            );
            textOpacity.value = withSequence(
                withTiming(0.5, TEXT_ANIMATION_CONFIG),
                withTiming(1, TEXT_ANIMATION_CONFIG)
            );
        }
    }, [pendingJobs.length, displayStatus]);

    // Show success state animation
    const showSuccessState = useCallback(() => {
        // Set status display state
        setDisplayStatus(STATUS.SUCCESS);

        // Hide text
        textOpacity.value = withTiming(0, { duration: 150 });

        // Setup background and border colors for success
        statusBgColor.value = withTiming('rgba(16, 185, 129, 0.1)', { duration: 300 });
        statusBorderColor.value = withTiming('rgba(16, 185, 129, 0.3)', { duration: 300 });

        // Show success icon
        iconScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back()) });
        iconOpacity.value = withTiming(1, { duration: 200 });

        // Reset after delay
        const resetToIdle = () => {
            setDisplayStatus(STATUS.IDLE);
            statusBgColor.value = withTiming('rgba(255, 255, 255, 0.05)', { duration: 300 });
            statusBorderColor.value = withTiming('rgba(255, 255, 255, 0.1)', { duration: 300 });
            iconScale.value = withTiming(0, { duration: 200 });
            iconOpacity.value = withTiming(0, { duration: 200 });
            textOpacity.value = withTiming(1, { duration: 200 });
        };

        // Schedule reset
        setTimeout(resetToIdle, STATUS_DISPLAY_DURATION);
    }, []);

    // Show failure state animation
    const showFailureState = useCallback(() => {
        // Set status display state
        setDisplayStatus(STATUS.FAILURE);

        // Hide text
        textOpacity.value = withTiming(0, { duration: 150 });

        // Setup background and border colors for failure
        statusBgColor.value = withTiming('rgba(239, 68, 68, 0.1)', { duration: 300 });
        statusBorderColor.value = withTiming('rgba(239, 68, 68, 0.3)', { duration: 300 });

        // Show failure icon with slight shake animation
        iconScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back()) });
        iconOpacity.value = withTiming(1, { duration: 200 });
        scale.value = withSequence(
            withTiming(1.05, { duration: 100 }),
            withTiming(0.95, { duration: 100 }),
            withTiming(1.03, { duration: 100 }),
            withTiming(0.97, { duration: 100 }),
            withTiming(1, { duration: 100 })
        );

        // Reset after delay
        const resetToIdle = () => {
            setDisplayStatus(STATUS.IDLE);
            statusBgColor.value = withTiming('rgba(255, 255, 255, 0.05)', { duration: 300 });
            statusBorderColor.value = withTiming('rgba(255, 255, 255, 0.1)', { duration: 300 });
            iconScale.value = withTiming(0, { duration: 200 });
            iconOpacity.value = withTiming(0, { duration: 200 });
            textOpacity.value = withTiming(1, { duration: 200 });
        };

        // Schedule reset
        setTimeout(resetToIdle, STATUS_DISPLAY_DURATION);
    }, []);

    // Handle press with proper dependencies
    const handlePress = useCallback(() => {
        cancelAnimation(scale);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        scale.value = withSequence(
            withSpring(0.9, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );

        // If showing a status, reset it on press
        if (displayStatus !== STATUS.IDLE) {
            setDisplayStatus(STATUS.IDLE);
            statusBgColor.value = withTiming('rgba(255, 255, 255, 0.05)', { duration: 300 });
            statusBorderColor.value = withTiming('rgba(255, 255, 255, 0.1)', { duration: 300 });
            iconScale.value = withTiming(0, { duration: 200 });
            iconOpacity.value = withTiming(0, { duration: 200 });
            textOpacity.value = withTiming(1, { duration: 200 });
        }
    }, [scale, displayStatus]);

    // Animated styles
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value }
        ],
    }));

    const gearStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` }
        ],
    }));

    const textStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: textScale.value }
        ],
        opacity: textOpacity.value,
    }));

    const statusContainerStyle = useAnimatedStyle(() => ({
        backgroundColor: statusBgColor.value,
        borderColor: statusBorderColor.value,
    }));

    const statusIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: iconScale.value }
        ],
        opacity: iconOpacity.value,
    }));

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.fixedContainer}>
                    <Animated.View style={[styles.placeholderContainer, statusContainerStyle]}>
                        {displayStatus === STATUS.IDLE && (
                            <Animated.View style={[styles.indicatorWrapper, gearStyle]}>
                                <Cog size={10} color="#9CA3AF" />
                            </Animated.View>
                        )}

                        {displayStatus === STATUS.SUCCESS && (
                            <Animated.View style={[styles.indicatorWrapper, statusIconStyle]}>
                                <Check size={12} color="#10B981" />
                            </Animated.View>
                        )}

                        {displayStatus === STATUS.FAILURE && (
                            <Animated.View style={[styles.indicatorWrapper, statusIconStyle]}>
                                <X size={12} color="#EF4444" />
                            </Animated.View>
                        )}
                    </Animated.View>
                </View>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={[styles.countContainer, textStyle]}
                >
                    <Animated.Text style={styles.countText}>
                        {pendingJobs.length > 0 ? `${pendingJobs.length} job${pendingJobs.length !== 1 ? 's' : ''}` : 'Idle'}
                    </Animated.Text>
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
        width: 85,
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
    countContainer: {
        marginLeft: 4,
    },
    countText: {
        fontSize: 11,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#9CA3AF',
        letterSpacing: 0.1,
    },
});

export default React.memo(JobIndicator);