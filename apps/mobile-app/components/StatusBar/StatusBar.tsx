import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, StatusBar as RNStatusBar, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    LinearTransition,
    SlideInUp,
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
    backgroundColor = '#2C3333', // Gun metal gray, fully opaque
    children
}) => {
    const insets = useSafeAreaInsets();

    const indicators = useMemo(() => [
        <ConnectionIndicator key="connection" />,
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

    const slideInConfig = useMemo(() =>
        SlideInUp.springify()
            .damping(ANIMATION_CONFIG.damping)
            .mass(ANIMATION_CONFIG.mass)
            .stiffness(ANIMATION_CONFIG.stiffness),
        []
    );

    const fadeInConfig = useMemo(() =>
        FadeIn.delay(200).springify()
            .damping(ANIMATION_CONFIG.damping)
            .mass(ANIMATION_CONFIG.mass)
            .stiffness(ANIMATION_CONFIG.stiffness),
        []
    );

    return (
        <View style={containerStyle}>
            <RNStatusBar
                barStyle="light-content"
                backgroundColor={backgroundColor}
                translucent
            />
            <Animated.View
                entering={slideInConfig}
                style={styles.content}
            >
                <Animated.Text
                    entering={fadeInConfig}
                    style={styles.title}
                >
                    MapMoji
                </Animated.Text>
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
            </Animated.View>
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
    title: {
        fontSize: 15,
        fontFamily: 'SpaceMono',
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    indicatorsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 2,
    },
});

export default React.memo(StatusBar); 