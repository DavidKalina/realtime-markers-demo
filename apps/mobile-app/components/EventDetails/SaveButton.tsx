import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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

    const handlePressIn = () => {
        scale.value = withSpring(0.9);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const handleSavePress = () => {
        if (savingState === "loading") return;

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
        <Pressable
            onPress={handleSavePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={savingState === "loading"}
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, styles.buttonContent, animatedStyle]}>
                {savingState === "loading" ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                ) : isSaved ? (
                    <BookmarkCheck size={24} color={COLORS.success} />
                ) : (
                    <Bookmark size={24} color={COLORS.accent} />
                )}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    saveButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    buttonContent: {
        width: '100%',
        height: '100%',
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 14,
    },
    loading: {
        opacity: 0.7,
    },
    saveButtonPressed: {
        // Add any styles for pressed state if needed
    },
});

export default React.memo(SaveButton); 