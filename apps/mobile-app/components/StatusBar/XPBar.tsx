import React, { useEffect, useState } from 'react';
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

const XPBar: React.FC<XPBarProps> = ({ backgroundColor = '#1a1a1a' }) => {
    const { user } = useAuth();
    const { publish } = useEventBroker();
    const [levelInfo, setLevelInfo] = useState({
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
    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressValue.value}%`,
    }));

    // Animation for XP gain indicator
    const xpGainStyle = useAnimatedStyle(() => ({
        opacity: xpGainOpacity.value,
        transform: [{ translateY: xpGainTranslateY.value }],
    }));

    // Animated XP text
    const AnimatedXPText = Animated.createAnimatedComponent(Text);
    const AnimatedNextLevelText = Animated.createAnimatedComponent(Text);
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

    // Fetch initial level info
    useEffect(() => {
        const fetchLevelInfo = async () => {
            try {
                const user = await apiClient.getUserProfile();
                const newLevelInfo = {
                    currentLevel: user.level || 1,
                    currentTitle: user.currentTitle || "Explorer",
                    totalXp: user.totalXp || 0,
                    nextLevelXp: user.nextLevelXp || 100,
                    progress: user.xpProgress || 0
                };
                setLevelInfo(newLevelInfo);
                // Initialize animation values
                progressValue.value = newLevelInfo.progress;
                totalXpValue.value = newLevelInfo.totalXp;
                nextLevelXpValue.value = newLevelInfo.nextLevelXp;
            } catch (error) {
                console.error('Error fetching level info:', error);
            }
        };

        fetchLevelInfo();
    }, []);

    // Subscribe to level updates
    useEffect(() => {
        const unsubscribe = eventBroker.on<LevelUpdateEvent>(EventTypes.LEVEL_UPDATE, (event) => {
            if (event.data.userId === user?.id) {
                setLevelInfo(prev => ({
                    ...prev,
                    currentLevel: event.data.level,
                    currentTitle: event.data.title,
                    progress: event.data.xpProgress
                }));
                // Animate progress change
                progressValue.value = withTiming(event.data.xpProgress, {
                    duration: 500,
                });
            }
        });

        return () => unsubscribe();
    }, [user?.id]);

    // Simulation effect
    useEffect(() => {
        if (!user?.id) return;

        // Simulate XP gains every 5 seconds
        const xpInterval = setInterval(() => {
            // Random XP amount between 10 and 30
            const xpAmount = Math.floor(Math.random() * 21) + 10;

            // Show XP gain animation
            showXPGain(xpAmount);

            // Publish XP awarded event
            publish<XPAwardedEvent>(EventTypes.XP_AWARDED, {
                timestamp: Date.now(),
                source: 'simulation',
                data: {
                    userId: user.id,
                    amount: xpAmount,
                    reason: 'Simulated activity',
                    timestamp: new Date().toISOString()
                }
            });

            // Calculate new progress
            const newTotalXp = levelInfo.totalXp + xpAmount;
            const newProgress = (newTotalXp % levelInfo.nextLevelXp) / levelInfo.nextLevelXp * 100;

            // Animate XP change
            totalXpValue.value = withTiming(newTotalXp, {
                duration: 500,
            });

            // Check if level up
            if (newTotalXp >= levelInfo.nextLevelXp) {
                const newLevel = levelInfo.currentLevel + 1;
                const newTitle = `Level ${newLevel} Explorer`;
                const newNextLevelXp = levelInfo.nextLevelXp * 1.5;

                // Animate next level XP change
                nextLevelXpValue.value = withTiming(newNextLevelXp, {
                    duration: 500,
                });

                // Publish level update event
                publish<LevelUpdateEvent>(EventTypes.LEVEL_UPDATE, {
                    timestamp: Date.now(),
                    source: 'simulation',
                    data: {
                        userId: user.id,
                        level: newLevel,
                        title: newTitle,
                        xpProgress: newProgress,
                        action: 'level_up',
                        timestamp: new Date().toISOString()
                    }
                });

                // Update local state
                setLevelInfo(prev => ({
                    ...prev,
                    currentLevel: newLevel,
                    currentTitle: newTitle,
                    nextLevelXp: newNextLevelXp,
                    totalXp: newTotalXp,
                    progress: newProgress
                }));
            } else {
                // Just update progress
                setLevelInfo(prev => ({
                    ...prev,
                    totalXp: newTotalXp,
                    progress: newProgress
                }));
            }

            // Animate progress change
            progressValue.value = withTiming(newProgress, {
                duration: 500,
            });
        }, 5000);

        return () => clearInterval(xpInterval);
    }, [user?.id, levelInfo, publish]);

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
                    <Animated.View style={[styles.progressBar, progressStyle]} />
                </View>
                <View style={styles.xpInfo}>
                    <AnimatedXPText style={styles.xpText}>
                        {Math.round(totalXpValue.value)} XP
                    </AnimatedXPText>
                    <AnimatedNextLevelText style={styles.nextLevelText}>
                        Next: {Math.round(nextLevelXpValue.value)} XP
                    </AnimatedNextLevelText>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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