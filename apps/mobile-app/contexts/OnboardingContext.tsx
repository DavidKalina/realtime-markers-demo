import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingContextType {
    hasCompletedOnboarding: boolean;
    completeOnboarding: () => Promise<void>;
    resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({} as OnboardingContextType);

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            try {
                const status = await AsyncStorage.getItem('@onboarding_completed');
                setHasCompletedOnboarding(status === 'true');
            } catch (error) {
                console.error('Error checking onboarding status:', error);
            }
        };

        checkOnboardingStatus();
    }, []);

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('@onboarding_completed', 'true');
            setHasCompletedOnboarding(true);
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    const resetOnboarding = async () => {
        try {
            await AsyncStorage.removeItem('@onboarding_completed');
            setHasCompletedOnboarding(false);
        } catch (error) {
            console.error('Error resetting onboarding:', error);
        }
    };

    const contextValue = useMemo(() => ({
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding,
    }), [hasCompletedOnboarding]);

    return (
        <OnboardingContext.Provider value={contextValue}>
            {children}
        </OnboardingContext.Provider>
    );
}; 