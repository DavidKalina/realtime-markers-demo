import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import DiscoveryIndicator from './DiscoveryIndicator/DiscoveryIndicator';
import CalendarIndicator from './CalendarIndicator';


interface RightIndicatorsContainerProps {
    showCalendarIndicator?: boolean;
    showDiscoveryIndicator?: boolean;
}

const RightIndicatorsContainer: React.FC<RightIndicatorsContainerProps> = ({
    showCalendarIndicator = true,
    showDiscoveryIndicator = true,
}) => {
    return (
        <View style={styles.container}>
            <Animated.View style={styles.indicatorsWrapper} layout={LinearTransition.springify()}>
                {showCalendarIndicator && (
                    <Animated.View
                        style={styles.indicatorContainer}
                        layout={LinearTransition.springify()}
                    >
                        <CalendarIndicator />
                    </Animated.View>
                )}

                {showDiscoveryIndicator && (
                    <Animated.View
                        style={styles.indicatorContainer}
                        layout={LinearTransition.springify()}
                    >
                        <DiscoveryIndicator position="custom" />
                    </Animated.View>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 180, // Slightly wider than the discovery indicator (160)
        pointerEvents: 'box-none',
        zIndex: 1000,
    },
    indicatorsWrapper: {
        position: 'absolute',
        top: 50, // Match the top padding from other indicators
        right: 16,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
    },
    indicatorContainer: {
        alignItems: 'flex-end',
    },
});

export default RightIndicatorsContainer; 