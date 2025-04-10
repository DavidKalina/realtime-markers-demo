import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    LinearTransition,
    FadeIn,
    useAnimatedStyle,
    withDelay,
} from 'react-native-reanimated';
import ConnectionIndicator from './ConnectionIndicator';
import DateRangeIndicator from './DateRangeIndicator';
import EmojiIndicator from './EmojiIndicator';
import JobIndicator from './JobIndicator';

interface StatusBarProps {
    backgroundColor?: string;
    children?: React.ReactNode;
}

const ANIMATION_CONFIG = {
    damping: 15,
    mass: 1,
    stiffness: 200,
};

const StatusBar: React.FC<StatusBarProps> = ({
    backgroundColor = '#1a1a1a', // Match Cluster Events view background
    children
}) => {
    const insets = useSafeAreaInsets();

    const indicators = useMemo(() => [
        <EmojiIndicator key="emoji" />,
        <DateRangeIndicator key="date" />,
        <JobIndicator key="job" />
    ], []);

    const containerStyle = useMemo(() => [
        styles.container,
        {
            backgroundColor,
            paddingTop: insets.top,
        }
    ], [backgroundColor, insets.top]);

    return (
        <View style={containerStyle}>
            <RNStatusBar
                barStyle="light-content"
                backgroundColor={backgroundColor}
                translucent
            />
            <View style={styles.content}>
                <Animated.View
                    entering={FadeIn
                        .delay(300)
                        .springify()
                        .damping(ANIMATION_CONFIG.damping)
                        .mass(ANIMATION_CONFIG.mass)
                        .stiffness(ANIMATION_CONFIG.stiffness)}
                >
                    <ConnectionIndicator />
                </Animated.View>
                <Animated.View
                    style={styles.indicatorsContainer}
                    layout={LinearTransition.duration(300)}
                >
                    {indicators.map((indicator, index) => (
                        <React.Fragment key={index}>
                            <Animated.View
                                entering={FadeIn
                                    .delay(300 + (index * 100))
                                    .springify()
                                    .damping(ANIMATION_CONFIG.damping)
                                    .mass(ANIMATION_CONFIG.mass)
                                    .stiffness(ANIMATION_CONFIG.stiffness)}
                            >
                                {indicator}
                            </Animated.View>
                            {index < indicators.length - 1 && (
                                <Animated.View
                                    entering={FadeIn
                                        .delay(300 + (index * 100))
                                        .springify()
                                        .damping(ANIMATION_CONFIG.damping)
                                        .mass(ANIMATION_CONFIG.mass)
                                        .stiffness(ANIMATION_CONFIG.stiffness)}
                                    style={styles.divider}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 0,
        paddingBottom: 6,
    },
    indicatorsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    divider: {
        width: 1,
        height: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 2,
    },
});

export default React.memo(StatusBar); 