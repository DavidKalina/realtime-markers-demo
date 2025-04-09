import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    withRepeat,
    Easing,
    FadeIn,
    SlideInRight,
} from 'react-native-reanimated';
import { Cog } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useJobSessionStore } from "@/stores/useJobSessionStore";

export const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const spinRotation = useSharedValue(0);

    // Get active jobs
    const activeJobs = React.useMemo(() => {
        return jobs.filter(job =>
            job.status === "processing" ||
            job.status === "pending"
        );
    }, [jobs]);

    // Calculate progress
    const progress = React.useMemo(() => {
        if (activeJobs.length === 0) return 0;

        // Calculate total progress across all active jobs
        const totalProgress = activeJobs.reduce((sum, job) => {
            // If job has a progress value, use it
            if (typeof job.progress === 'number') {
                return sum + job.progress;
            }
            // If no progress value, assume 0
            return sum;
        }, 0);

        // Calculate average progress
        return Math.round((totalProgress / activeJobs.length));
    }, [activeJobs]);

    // Setup continuous spinning animation
    useEffect(() => {
        if (activeJobs.length > 0) {
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
    }, [activeJobs.length]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.95, { damping: 10, stiffness: 200 }),
            withSpring(1, { damping: 10, stiffness: 200 })
        );
        rotation.value = withSequence(
            withTiming(-5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
            withTiming(5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) })
        );
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

    // Don't render if no active jobs
    if (activeJobs.length === 0) return null;

    return (
        <Animated.View
            entering={SlideInRight.springify().damping(15).mass(1).stiffness(200)}
            style={styles.container}
        >
            <View style={styles.iconContainer}>
                <Animated.View style={[animatedStyle, spinAnimatedStyle]}>
                    <Cog size={12} color="#FF6B00" />
                </Animated.View>
            </View>
            <Text style={styles.text}>
                {progress}%
            </Text>
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
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 107, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#FF6B00',
        letterSpacing: 0.2,
    },
}); 