import React from 'react';
import { View, StyleSheet, Platform, StatusBar as RNStatusBar, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    LinearTransition,
    SlideInDown,
    FadeIn,
    useAnimatedStyle,
    withDelay,
} from 'react-native-reanimated';
import { ConnectionIndicator } from './ConnectionIndicator';
import { DateRangeIndicator } from './DateRangeIndicator';
import { EmojiIndicator } from './EmojiIndicator';

interface StatusBarProps {
    backgroundColor?: string;
    children?: React.ReactNode;
}

export const StatusBar: React.FC<StatusBarProps> = ({
    backgroundColor = '#2C3333', // Gun metal gray, fully opaque
    children
}) => {
    const insets = useSafeAreaInsets();

    const indicators = [
        <ConnectionIndicator key="connection" />,
        <EmojiIndicator key="emoji" />,
        <DateRangeIndicator key="date" />
    ];

    return (
        <Animated.View
            entering={SlideInDown.springify()
                .damping(15)
                .mass(1)
                .stiffness(200)
                .delay(100)}
            style={[
                styles.container,
                {
                    backgroundColor,
                    paddingTop: insets.top,
                }
            ]}
        >
            <RNStatusBar
                barStyle="light-content"
                backgroundColor={backgroundColor}
                translucent
            />
            <View style={styles.content}>
                <Animated.Text
                    entering={FadeIn.delay(300).springify()}
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
                                    .delay(400 + (index * 100))
                                    .springify()
                                    .damping(15)
                                    .mass(1)
                                    .stiffness(200)}
                            >
                                {indicator}
                            </Animated.View>
                            {index < indicators.length - 1 && (
                                <Animated.View
                                    entering={FadeIn
                                        .delay(400 + (index * 100))
                                        .springify()
                                        .damping(15)
                                        .mass(1)
                                        .stiffness(200)}
                                    style={styles.divider}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </Animated.View>
            </View>
        </Animated.View>
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
        fontSize: 16,
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