import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Bookmark, BookmarkCheck } from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withTiming,
    interpolateColor,
} from 'react-native-reanimated';

const COLORS = {
    accent: "#93c5fd",
    buttonBackground: "rgba(147, 197, 253, 0.1)",
    success: "#40c057",
};

interface SaveButtonProps {
    isSaved: boolean;
    savingState: "idle" | "loading";
    onSave: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({ isSaved, savingState, onSave }) => {
    const scale = useSharedValue(1);
    const color = useSharedValue(0);

    // Update color when save state changes
    React.useEffect(() => {
        if (savingState === "idle") {
            color.value = withTiming(isSaved ? 1 : 0, { duration: 300 });
        }
    }, [isSaved, savingState]);

    const handlePress = () => {
        if (savingState === "loading") return;

        // Simple scale animation on press
        scale.value = withSpring(0.95, { damping: 10 }, () => {
            scale.value = withSpring(1, { damping: 10 });
        });

        onSave();
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            backgroundColor: interpolateColor(
                color.value,
                [0, 1],
                [COLORS.buttonBackground, COLORS.success + '20']
            ),
        };
    });

    return (
        <Animated.View style={[styles.saveButton, animatedStyle]}>
            <TouchableOpacity
                style={[styles.button, savingState === "loading" && styles.loading]}
                onPress={handlePress}
                disabled={savingState === "loading"}
                activeOpacity={0.7}
            >
                {savingState === "loading" ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                ) : isSaved ? (
                    <BookmarkCheck size={24} color={COLORS.success} />
                ) : (
                    <Bookmark size={24} color={COLORS.accent} />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    saveButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    button: {
        width: '100%',
        height: '100%',
        justifyContent: "center",
        alignItems: "center",
    },
    loading: {
        opacity: 0.7,
    },
});

export default React.memo(SaveButton); 