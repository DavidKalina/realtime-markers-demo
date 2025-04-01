import NetInfo, { NetInfoState, NetInfoSubscription, NetInfoCellularGeneration } from '@react-native-community/netinfo';
import { useEffect, useState, useCallback } from 'react';

export interface NetworkQualityState {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string | null;
    isWifiEnabled: boolean;
    isCellularEnabled: boolean;
    strength: number; // 0-100
    details: {
        cellularGeneration?: NetInfoCellularGeneration | null;
        wifiStrength?: number | null;
        isWifiEnabled?: boolean;
        isCellularEnabled?: boolean;
    };
}

const DEFAULT_STATE: NetworkQualityState = {
    isConnected: false,
    isInternetReachable: null,
    type: null,
    isWifiEnabled: false,
    isCellularEnabled: false,
    strength: 0,
    details: {},
};

export const useNetworkQuality = () => {
    const [networkState, setNetworkState] = useState<NetworkQualityState>(DEFAULT_STATE);
    const [subscription, setSubscription] = useState<NetInfoSubscription | null>(null);

    // Calculate network strength based on available information
    const calculateStrength = useCallback((state: NetInfoState): number => {
        if (!state.isConnected) return 0;

        // If we have WiFi strength, use that
        if (state.type === 'wifi' && state.details && 'strength' in state.details) {
            return Math.min(100, Math.max(0, (state.details.strength ?? 0) * 100));
        }

        // For cellular, use a default value based on generation
        if (state.type === 'cellular' && state.details && 'cellularGeneration' in state.details) {
            const generation = state.details.cellularGeneration;
            switch (generation) {
                case '5g':
                    return 100;
                case '4g':
                    return 80;
                case '3g':
                    return 60;
                case '2g':
                    return 40;
                default:
                    return 50;
            }
        }

        // Default strength for other connection types
        return state.isConnected ? 70 : 0;
    }, []);

    // Process network state updates
    const handleNetworkStateChange = useCallback((state: NetInfoState) => {
        // Ensure we have the correct network type
        const networkType = state.type || 'none';
        const isWifiEnabled = networkType === 'wifi';
        const isCellularEnabled = networkType === 'cellular';

        const newState: NetworkQualityState = {
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable,
            type: networkType,
            isWifiEnabled,
            isCellularEnabled,
            strength: calculateStrength(state),
            details: {
                cellularGeneration: isCellularEnabled && state.details && 'cellularGeneration' in state.details
                    ? (state.details as { cellularGeneration: NetInfoCellularGeneration }).cellularGeneration
                    : null,
                wifiStrength: isWifiEnabled && state.details && 'strength' in state.details
                    ? (state.details as { strength: number }).strength
                    : null,
                isWifiEnabled,
                isCellularEnabled,
            },
        };

        setNetworkState(newState);
    }, [calculateStrength]);

    // Initialize network monitoring
    useEffect(() => {
        // Get initial state
        NetInfo.fetch().then(handleNetworkStateChange);

        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(handleNetworkStateChange);
        setSubscription(unsubscribe);

        return () => {
            if (subscription) {
                subscription();
            }
        };
    }, [handleNetworkStateChange]);

    return networkState;
}; 