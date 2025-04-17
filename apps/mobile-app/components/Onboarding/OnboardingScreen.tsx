import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
    {
        title: 'Welcome to MapMoji!',
        description: 'Discover and scan events around you to earn XP and unlock rewards.',
    },
    {
        title: 'Scan Events',
        description: 'Use your camera to scan event posters and flyers to add them to the map.',
    },
    {
        title: 'Browse & Filter',
        description: 'Find events that match your interests using our smart filters.',
    },
    {
        title: 'Earn XP',
        description: 'Get XP for each unique event you scan. The more you scan, the more you earn!',
    },
];

export const OnboardingScreen: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const { completeOnboarding } = useOnboarding();
    const router = useRouter();

    const handleNext = () => {
        Haptics.selectionAsync();
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            completeOnboarding();
            router.replace('/');
        }
    };

    const handleSkip = () => {
        Haptics.selectionAsync();
        completeOnboarding();
        router.replace('/');
    };

    return (
        <View style={styles.container}>
            <Animated.View
                key={currentStep}
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.content}
            >
                <Text style={styles.title}>{ONBOARDING_STEPS[currentStep].title}</Text>
                <Text style={styles.description}>
                    {ONBOARDING_STEPS[currentStep].description}
                </Text>
            </Animated.View>

            <View style={styles.footer}>
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>

                <View style={styles.stepsContainer}>
                    {ONBOARDING_STEPS.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.stepDot,
                                currentStep === index && styles.activeStepDot,
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                    <Text style={styles.nextText}>
                        {currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        padding: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#f8f9fa',
        textAlign: 'center',
        marginBottom: 20,
    },
    description: {
        fontSize: 16,
        color: '#a0a0a0',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 40,
    },
    skipButton: {
        padding: 10,
    },
    skipText: {
        color: '#a0a0a0',
        fontSize: 16,
    },
    stepsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2a2a2a',
        marginHorizontal: 5,
    },
    activeStepDot: {
        backgroundColor: '#93c5fd',
    },
    nextButton: {
        backgroundColor: '#93c5fd',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    nextText: {
        color: '#1a1a1a',
        fontSize: 16,
        fontWeight: '600',
    },
}); 