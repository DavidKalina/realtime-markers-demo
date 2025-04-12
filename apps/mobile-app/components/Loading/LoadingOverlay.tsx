import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../Layout/ScreenLayout';

interface LoadingOverlayProps {
    message?: string;
    subMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(({
    message = "Finding your location...",
    subMessage = "We'll show you events nearby"
}) => {
    return (
        <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
                <ActivityIndicator
                    size="large"
                    color={COLORS.accent}
                    style={styles.loadingSpinner}
                />
                <Text style={styles.loadingText}>{message}</Text>
                <Text style={styles.loadingSubtext}>{subMessage}</Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: COLORS.cardBackground,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    loadingSpinner: {
        marginBottom: 16,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        fontFamily: 'SpaceMono',
        marginBottom: 8,
    },
    loadingSubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontFamily: 'SpaceMono',
    },
}); 