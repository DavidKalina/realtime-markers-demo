import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { Wifi, WifiOff, Signal } from "lucide-react-native";
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
    FadeIn,
    FadeOut,
    Layout,
    SlideInLeft,
    SlideOutLeft,
} from "react-native-reanimated";

interface NetworkQualityIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

// Pre-define animations to avoid recreation
const SPRING_LAYOUT = Layout.springify();
const SLIDE_IN = SlideInLeft.springify()
    .damping(20)
    .mass(1.2)
    .stiffness(150);
const SLIDE_OUT = SlideOutLeft.springify()
    .damping(20)
    .mass(1.2)
    .stiffness(150);
const FADE_IN = FadeIn.duration(400).delay(100);

// Get status color based on network strength
const getStatusColor = (strength: number): string => {
    if (strength >= 80) return "#4caf50"; // Green for excellent
    if (strength >= 60) return "#8bc34a"; // Light green for good
    if (strength >= 40) return "#ffc107"; // Yellow for fair
    if (strength >= 20) return "#ff9800"; // Orange for poor
    return "#f44336"; // Red for very poor
};

// Get network type text
const getNetworkTypeText = (type: string | null): string => {
    switch (type) {
        case "wifi":
            return "WiFi";
        case "cellular":
            return "Cellular";
        case "ethernet":
            return "Ethernet";
        case "vpn":
            return "VPN";
        default:
            return "Unknown";
    }
};

export const NetworkQualityIndicator: React.FC<NetworkQualityIndicatorProps> = React.memo(
    ({ position = "top-right" }) => {
        const networkState = useNetworkQuality();

        // Get position styles based on position prop
        const positionStyle = useMemo(() => {
            switch (position) {
                case "top-left":
                    return { top: 50, left: 16 };
                case "bottom-right":
                    return { bottom: 50, right: 16 };
                case "bottom-left":
                    return { bottom: 50, left: 16 };
                case "custom":
                    return {};
                case "top-right":
                default:
                    return { top: 50, right: 16 };
            }
        }, [position]);

        // Get status color based on network strength
        const statusColor = useMemo(() => {
            return getStatusColor(networkState.strength);
        }, [networkState.strength]);

        // Get network type text
        const networkTypeText = useMemo(() => {
            return getNetworkTypeText(networkState.type);
        }, [networkState.type]);

        // Get strength text
        const strengthText = useMemo(() => {
            if (!networkState.isConnected) return "No Connection";
            return `${networkState.strength}%`;
        }, [networkState.isConnected, networkState.strength]);

        // Get icon based on connection state
        const icon = useMemo(() => {
            if (!networkState.isConnected) {
                return <WifiOff size={16} color="#fff" />;
            }
            return <Signal size={16} color="#fff" />;
        }, [networkState.isConnected]);

        return (
            <Animated.View
                style={[styles.container, positionStyle]}
                entering={SLIDE_IN}
                exiting={SLIDE_OUT}
                layout={SPRING_LAYOUT}
            >
                <Animated.View style={[styles.indicator, { backgroundColor: statusColor }]} layout={SPRING_LAYOUT}>
                    {icon}
                </Animated.View>

                <View style={styles.contentContainer}>
                    <Animated.Text
                        style={styles.networkTypeText}
                        entering={FADE_IN}
                        exiting={FadeOut.duration(300)}
                        layout={SPRING_LAYOUT}
                    >
                        {networkTypeText}
                    </Animated.Text>
                    <Animated.Text
                        style={styles.strengthText}
                        entering={FADE_IN}
                        exiting={FadeOut.duration(300)}
                        layout={SPRING_LAYOUT}
                    >
                        {strengthText}
                    </Animated.Text>
                </View>
            </Animated.View>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(51, 51, 51, 0.92)",
        borderRadius: 16,
        padding: 8,
        paddingRight: 10,
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        maxWidth: 140,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    indicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    contentContainer: {
        flexDirection: "column",
        flex: 1,
    },
    networkTypeText: {
        color: "#f8f9fa",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    strengthText: {
        color: "rgba(248, 249, 250, 0.7)",
        fontSize: 9,
        fontFamily: "SpaceMono",
        fontWeight: "500",
    },
});

export default NetworkQualityIndicator; 