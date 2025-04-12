import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    FadeIn,
    FadeOut,
    cancelAnimation,
} from 'react-native-reanimated';
import { Cog } from 'lucide-react-native';
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

const JobIndicator: React.FC = () => {
    const jobs = useJobSessionStore((state) => state.jobs);
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Get pending jobs with memoization
    const pendingJobs = useMemo(() => {
        return jobs.filter(job => job.status === "pending" || job.status === "processing");
    }, [jobs]);

    // Setup spinning animation when there are pending jobs
    useEffect(() => {
        if (pendingJobs.length > 0) {
            rotation.value = withRepeat(
                withTiming(360, SPIN_CONFIG),
                -1,
                false
            );
        } else {
            cancelAnimation(rotation);
            rotation.value = 0;
        }

        return () => {
            cancelAnimation(rotation);
        };
    }, [pendingJobs.length, rotation]);

    // Handle press with proper dependencies
    const handlePress = useCallback(() => {
        cancelAnimation(scale);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        scale.value = withSequence(
            withSpring(0.9, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );
    }, [scale]);

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

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.fixedContainer}>
                    <View style={styles.placeholderContainer}>
                        <Animated.View style={[styles.indicatorWrapper, gearStyle]}>
                            <Cog size={10} color="#9CA3AF" />
                        </Animated.View>
                    </View>
                </View>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.countContainer}
                >
                    <Text style={styles.countText}>{pendingJobs.length} job{pendingJobs.length > 1 ? 's' : ''}</Text>
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