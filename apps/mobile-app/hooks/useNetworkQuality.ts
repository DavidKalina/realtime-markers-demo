import NetInfo, { NetInfoState, NetInfoSubscription, NetInfoCellularGeneration } from '@react-native-community/netinfo';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

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
    const appState = useRef(AppState.currentState);
    const lastCheckTime = useRef(Date.now());

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
        console.log('Raw NetInfo state:', state); // Log raw state

        // Get the current network type
        const networkType = state.type || 'none';

        // Check if WiFi is actually enabled and connected
        const isWifiEnabled = networkType === 'wifi' && (state.isConnected ?? false);
        const isCellularEnabled = networkType === 'cellular' && (state.isConnected ?? false);

        // If we're not connected, reset the network type
        const effectiveType = (state.isConnected ?? false) ? networkType : 'none';

        const newState: NetworkQualityState = {
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable,
            type: effectiveType,
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

        console.log('Processed network state:', newState); // Log processed state
        setNetworkState(newState);
    }, [calculateStrength]);

    // Initialize network monitoring
    useEffect(() => {
        let isSubscribed = true;
        let intervalId: NodeJS.Timeout | null = null;
        let appStateSubscription: { remove: () => void } | null = null;

        const setupNetworkMonitoring = async () => {
            try {
                // Get initial state
                const initialState = await NetInfo.fetch();
                console.log('Initial network state:', initialState);

                if (isSubscribed) {
                    handleNetworkStateChange(initialState);
                }

                // Subscribe to network state changes
                const unsubscribe = NetInfo.addEventListener((state) => {
                    if (!isSubscribed) return;
                    console.log('Network state change detected:', state);
                    handleNetworkStateChange(state);
                });

                // Set up a periodic check for network changes
                intervalId = setInterval(async () => {
                    if (!isSubscribed || appState.current !== 'active') return;

                    try {
                        const now = Date.now();
                        // Only check if at least 10 seconds have passed since last check
                        if (now - lastCheckTime.current >= 10000) {
                            const currentState = await NetInfo.fetch();
                            if (isSubscribed) {
                                handleNetworkStateChange(currentState);
                                lastCheckTime.current = now;
                            }
                        }
                    } catch (error) {
                        console.error('Error in network check interval:', error);
                    }
                }, 10000);

                // Subscribe to app state changes
                appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
                    if (!isSubscribed) return;
                    appState.current = nextAppState;
                    if (nextAppState === 'active') {
                        // Check network state when app comes to foreground
                        NetInfo.fetch().then(state => {
                            if (isSubscribed) {
                                handleNetworkStateChange(state);
                            }
                        });
                    }
                });

                if (isSubscribed) {
                    setSubscription(() => {
                        return () => {
                            unsubscribe();
                            if (intervalId) clearInterval(intervalId);
                            if (appStateSubscription) appStateSubscription.remove();
                        };
                    });
                }
            } catch (error) {
                console.error('Error setting up network monitoring:', error);
            }
        };

        setupNetworkMonitoring();

        return () => {
            isSubscribed = false;
            if (subscription) {
                subscription();
            }
            if (intervalId) {
                clearInterval(intervalId);
            }
            if (appStateSubscription) {
                appStateSubscription.remove();
            }
        };
    }, [handleNetworkStateChange]);

    return networkState;
}; 