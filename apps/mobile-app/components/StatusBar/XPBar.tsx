import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    withSequence,
    withDelay,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/ApiClient';
import { eventBroker, EventTypes, LevelUpdateEvent, XPAwardedEvent } from '@/services/EventBroker';
import { useEventBroker } from '@/hooks/useEventBroker';

interface XPBarProps {
    backgroundColor?: string;
}

interface LevelInfo {
    currentLevel: number;
    currentTitle: string;
    totalXp: number;
    nextLevelXp: number;
    progress: number;
}

const XPBar: React.FC<XPBarProps> = ({ backgroundColor = '#1a1a1a' }) => {
    const { user } = useAuth();
    const { publish } = useEventBroker();
    const [levelInfo, setLevelInfo] = useState<LevelInfo>({
        currentLevel: 1,
        currentTitle: "Explorer",
        totalXp: 0,
        nextLevelXp: 100,
        progress: 0
    });

    // Shared values for animations
    const progressValue = useSharedValue(0);
    const totalXpValue = useSharedValue(0);
    const nextLevelXpValue = useSharedValue(100);
    const xpGainOpacity = useSharedValue(0);
    const xpGainTranslateY = useSharedValue(0);
    const [xpGainAmount, setXpGainAmount] = useState(0);

    // Animation values for progress bar
    const progressStyle = useAnimatedStyle(() => {
        const progress = Math.min(Math.max(progressValue.value, 0), 100);
        console.log('Progress bar width:', progress);
        return {
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#4ADE80',
            borderRadius: 1.5,
        };
    });

    // Animation for XP gain indicator
    const xpGainStyle = useAnimatedStyle(() => ({
        opacity: xpGainOpacity.value,
        transform: [{ translateY: xpGainTranslateY.value }],
    }));

    const AnimatedXPGainText = Animated.createAnimatedComponent(Text);

    // Function to show XP gain animation
    const showXPGain = (amount: number) => {
        setXpGainAmount(amount);
        xpGainOpacity.value = withSequence(
            withTiming(1, { duration: 200 }),
            withDelay(1000, withTiming(0, { duration: 300 }))
        );
        xpGainTranslateY.value = withSequence(
            withTiming(-5, { duration: 200 }),
            withDelay(1000, withTiming(0, { duration: 300 }))
        );
    };

    // Function to fetch latest XP data from database
    const fetchLatestXPData = useCallback(async () => {
        try {
            const user = await apiClient.getUserProfile();
            console.log("Raw user data from API:", user);

            const newLevelInfo = {
                currentLevel: user.level || 1,
                currentTitle: user.currentTitle || "Explorer",
                totalXp: user.totalXp || 0,
                nextLevelXp: user.nextLevelXp || 100,
                progress: user.xpProgress || 0
            };

            console.log("Processed level info:", newLevelInfo);
            console.log("Progress calculation:", {
                totalXp: newLevelInfo.totalXp,
                nextLevelXp: newLevelInfo.nextLevelXp,
                rawProgress: newLevelInfo.progress,
                calculatedProgress: (newLevelInfo.totalXp / newLevelInfo.nextLevelXp) * 100
            });

            // Update state and animation values
            setLevelInfo(newLevelInfo);

            // Ensure progress is between 0 and 100
            const clampedProgress = Math.min(Math.max(newLevelInfo.progress, 0), 100);
            console.log("Setting progress to:", clampedProgress);

            // Animate the progress change
            progressValue.value = withTiming(clampedProgress, {
                duration: 500,
            });

            totalXpValue.value = newLevelInfo.totalXp;
            nextLevelXpValue.value = newLevelInfo.nextLevelXp;
        } catch (error) {
            console.error('Error fetching level info:', error);
        }
    }, []);

    // Fetch initial level info
    useEffect(() => {
        fetchLatestXPData();
    }, [fetchLatestXPData]);

    // Subscribe to level updates and XP awards
    useEffect(() => {
        const levelUnsubscribe = eventBroker.on<LevelUpdateEvent>(EventTypes.LEVEL_UPDATE, async (event) => {
            if (event.data.userId === user?.id) {
                console.log("Received level update event:", event.data);
                // Fetch latest data to ensure we're in sync
                await fetchLatestXPData();
            }
        });

        const xpUnsubscribe = eventBroker.on<XPAwardedEvent>(EventTypes.XP_AWARDED, async (event) => {
            if (event.data.userId === user?.id) {
                console.log("Received XP award event:", event.data);
                // Show XP gain animation
                showXPGain(event.data.amount);

                // Fetch latest data to ensure we're in sync
                await fetchLatestXPData();
            }
        });

        return () => {
            levelUnsubscribe();
            xpUnsubscribe();
        };
    }, [user?.id, fetchLatestXPData]);

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <View style={styles.content}>
                <View style={styles.levelInfo}>
                    <View style={styles.levelTitleContainer}>
                        <Text style={styles.levelText}>Lv. {levelInfo.currentLevel}</Text>
                        <Text style={styles.titleText}>{levelInfo.currentTitle}</Text>
                    </View>
                    <AnimatedXPGainText style={[styles.xpGainText, xpGainStyle]}>
                        +{xpGainAmount} XP
                    </AnimatedXPGainText>
                </View>
                <View style={styles.progressContainer}>
                    <Animated.View style={progressStyle} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 4,
    },
    content: {
        paddingHorizontal: 12,
    },
    levelInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        justifyContent: 'space-between',
    },
    levelTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    levelText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11,
        fontFamily: 'SpaceMono',
        marginRight: 6,
    },
    titleText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        fontFamily: 'SpaceMono',
    },
    xpGainText: {
        color: '#4ADE80',
        fontSize: 11,
        fontFamily: 'SpaceMono',
        fontWeight: 'bold',
    },
    progressContainer: {
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 1.5,
        overflow: 'hidden',
        marginBottom: 2,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4ADE80',
        borderRadius: 1.5,
    },
    xpInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    xpText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 10,
        fontFamily: 'SpaceMono',
    },
    nextLevelText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontFamily: 'SpaceMono',
    },
});

export default React.memo(XPBar); 