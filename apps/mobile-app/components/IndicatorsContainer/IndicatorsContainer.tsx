import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Layout, LinearTransition } from 'react-native-reanimated';
import { ConnectionIndicator } from '../ConnectionIndicator/ConnectionIndicator';
import FilterIndicator from '../FilterIndicator/FilterIndicator';
import QueueIndicator from '../QueueIndicator/QueueIndicator';
import DiscoveryIndicator from '../DiscoveryIndicator/DiscoveryIndicator';

interface IndicatorsContainerProps {
    showConnectionIndicator?: boolean;
    showQueueIndicator?: boolean;
    showFilterIndicator?: boolean;
    showDiscoveryIndicator?: boolean;
}

const IndicatorsContainer: React.FC<IndicatorsContainerProps> = ({
    showConnectionIndicator = true,
    showQueueIndicator = true,
    showFilterIndicator = true,
    showDiscoveryIndicator = true,
}) => {
    return (
        <View style={styles.container}>
            <Animated.View style={styles.indicatorsWrapper} layout={LinearTransition.springify()}>
                {showConnectionIndicator && (
                    <Animated.View layout={LinearTransition.springify()}>
                        <ConnectionIndicator />
                    </Animated.View>
                )}

                {showQueueIndicator && (
                    <Animated.View layout={LinearTransition.springify()}>
                        <QueueIndicator />
                    </Animated.View>
                )}

                {showFilterIndicator && (
                    <Animated.View layout={LinearTransition.springify()}>
                        <FilterIndicator />
                    </Animated.View>
                )}

                {showDiscoveryIndicator && (
                    <Animated.View layout={LinearTransition.springify()}>
                        <DiscoveryIndicator position="top-right" />
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
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'box-none',
        zIndex: 1000,
    },
    indicatorsWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        gap: 8,
        paddingTop: 50,
        paddingLeft: 16,
        paddingRight: 16,
    },
});

export default IndicatorsContainer; 