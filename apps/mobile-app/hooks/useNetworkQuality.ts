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
    const [isLoading, setIsLoading] = useState(true);
    const [subscription, setSubscription] = useState<NetInfoSubscription | null>(null);
    const appState = useRef(AppState.currentState);
    const lastCheckTime = useRef(Date.now());
    const isMounted = useRef(true);
    const initialFetchDone = useRef(false);

    // Calculate network strength based on available information
    const calculateStrength = useCallback((state: NetInfoState): number => {
        try {
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
        } catch (error) {
            console.error('Error calculating network strength:', error);
            return 0;
        }
    }, []);

    // Process network state updates
    const handleNetworkStateChange = useCallback((state: NetInfoState) => {
        if (!isMounted.current) return;

        try {
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

            setNetworkState(newState);
            setIsLoading(false);
        } catch (error) {
            console.error('Error processing network state:', error);
            // Set a safe default state in case of error
            if (isMounted.current) {
                setNetworkState(DEFAULT_STATE);
                setIsLoading(false);
            }
        }
    }, [calculateStrength]);

    // Initialize network monitoring
    useEffect(() => {
        isMounted.current = true;
        let isSubscribed = true;
        let intervalId: NodeJS.Timeout | null = null;
        let appStateSubscription: { remove: () => void } | null = null;
        let netInfoUnsubscribe: (() => void) | null = null;

        const setupNetworkMonitoring = async () => {
            try {
                // Only do initial fetch if not already done
                if (!initialFetchDone.current) {
                    setIsLoading(true);
                    const initialState = await NetInfo.fetch();
                    if (isSubscribed && isMounted.current) {
                        handleNetworkStateChange(initialState);
                        initialFetchDone.current = true;
                    }
                }

                // Subscribe to network state changes
                netInfoUnsubscribe = NetInfo.addEventListener((state) => {
                    if (!isSubscribed || !isMounted.current) return;
                    try {
                        handleNetworkStateChange(state);
                    } catch (error) {
                        console.error('Error handling network state change:', error);
                    }
                });

                // Set up a periodic check for network changes
                intervalId = setInterval(async () => {
                    if (!isSubscribed || !isMounted.current || appState.current !== 'active') return;

                    try {
                        const now = Date.now();
                        // Only check if at least 10 seconds have passed since last check
                        if (now - lastCheckTime.current >= 10000) {
                            const currentState = await NetInfo.fetch();
                            if (isSubscribed && isMounted.current) {
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
                    if (!isSubscribed || !isMounted.current) return;
                    appState.current = nextAppState;
                    if (nextAppState === 'active') {
                        // Check network state when app comes to foreground
                        NetInfo.fetch().then(state => {
                            if (isSubscribed && isMounted.current) {
                                handleNetworkStateChange(state);
                            }
                        }).catch(error => {
                            console.error('Error fetching network state on app active:', error);
                        });
                    }
                });

                if (isSubscribed && isMounted.current) {
                    setSubscription(() => {
                        return () => {
                            if (netInfoUnsubscribe) netInfoUnsubscribe();
                            if (intervalId) clearInterval(intervalId);
                            if (appStateSubscription) appStateSubscription.remove();
                        };
                    });
                }
            } catch (error) {
                console.error('Error setting up network monitoring:', error);
                setIsLoading(false);
            }
        };

        setupNetworkMonitoring();

        return () => {
            isMounted.current = false;
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
            if (netInfoUnsubscribe) {
                netInfoUnsubscribe();
            }
        };
    }, [handleNetworkStateChange]);

    return { ...networkState, isLoading };
}; 