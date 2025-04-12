import React, { forwardRef } from "react";
import {
    StyleSheet,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import Animated, {
    FadeInDown,
    LinearTransition,
} from "react-native-reanimated";
import { LucideIcon } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";


interface InputProps extends Omit<TextInputProps, 'style'> {
    icon?: LucideIcon;
    rightIcon?: LucideIcon;
    onRightIconPress?: () => void;
    error?: string;
    delay?: number;
    style?: ViewStyle;
}

const Input = forwardRef<TextInput, InputProps>(
    (
        {
            icon: Icon,
            rightIcon: RightIcon,
            onRightIconPress,
            error,
            delay = 0,
            style,
            ...props
        },
        ref
    ) => {
        return (
            <Animated.View
                entering={FadeInDown.duration(600).delay(delay).springify()}
                layout={LinearTransition.springify()}
                style={[styles.container, error && styles.errorContainer, style]}
            >
                {Icon && (
                    <View style={styles.iconContainer}>
                        <Icon size={18} color={error ? "#f97583" : "#93c5fd"} />
                    </View>
                )}
                <TextInput
                    ref={ref}
                    style={[styles.input, error && styles.errorInput]}
                    placeholderTextColor="#808080"
                    {...props}
                />
                {RightIcon && (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIconContainer}
                        disabled={!onRightIconPress}
                    >
                        <RightIcon size={18} color={error ? "#f97583" : "#93c5fd"} />
                    </TouchableOpacity>
                )}
            </Animated.View>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 55,
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
    },
    errorContainer: {
        borderColor: "#f97583",
    },
    iconContainer: {
        marginRight: 10,
    },
    rightIconContainer: {
        padding: 8,
    },
    input: {
        flex: 1,
        height: "100%",
        color: COLORS.textPrimary,
        fontSize: 16,
        fontFamily: "SpaceMono",
    },
    errorInput: {
        color: "#f97583",
    },
});

export default Input; 