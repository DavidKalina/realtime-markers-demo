import React, { useEffect, useMemo, useState, useRef } from 'react';
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

    // Update state based on active jobs
    useEffect(() => {
        const activeJob = activeJobs[0];

        if (activeJobs.length > 0) {
            setState('processing');
        } else if (state === 'processing') {
            const isSuccess = activeJob?.status === 'completed';
            setJobMessage({
                emoji: isSuccess ? "✅" : "❌",
                message: isSuccess ? "Completed" : "Failed"
            });
            setState('jobMessage');

            setTimeout(() => {
                setState('idle');
                setJobMessage(null);
            }, 3000);
        }
    }, [activeJobs, state]);

    // Setup continuous spinning animation
    useEffect(() => {
        if (state === 'processing') {
            spinRotation.value = withRepeat(
                withTiming(360, SPIN_CONFIG),
                -1,
                false
            );
        } else {
            spinRotation.value = 0;
        }
    }, [state]);

    const handlePress = useMemo(() => () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.9, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );
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

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Animated.View style={[styles.container, animatedStyle]}>
                {state === 'processing' ? (
                    <CircularProgress
                        progress={progress}
                        message={jobMessage ? {
                            emoji: jobMessage.emoji,
                            text: jobMessage.message
                        } : undefined}
                    >
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
                                <Animated.View>
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
                                            <Cog size={10} color="#FF6B00" />
                                        </Animated.View>
                                    </Animated.View>
                                </Animated.View>
                            </Animated.View>
                        </View>
                    </CircularProgress>
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
                                    <X size={10} color="#F44336" />
                                )}
                            </Animated.View>
                        )}
                    </View>
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
        position: 'relative',
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
    indicatorWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default React.memo(JobIndicator);