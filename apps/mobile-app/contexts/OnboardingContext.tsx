import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  totalSteps: number;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  setCurrentStep: (step: number) => void;
  getProgressPercentage: () => number;
}

const OnboardingContext = createContext<OnboardingContextType>(
  {} as OnboardingContextType,
);

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 9; // Updated to match the new total number of steps

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const status = await AsyncStorage.getItem("@onboarding_completed");
        setHasCompletedOnboarding(status === "true");
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
    };

    checkOnboardingStatus();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("@onboarding_completed", "true");
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem("@onboarding_completed");
      setHasCompletedOnboarding(false);
      setCurrentStep(0);
    } catch (error) {
      console.error("Error resetting onboarding:", error);
    }
  };

  const getProgressPercentage = () => {
    return Math.round((currentStep / (totalSteps - 1)) * 100);
  };

  const contextValue = useMemo(
    () => ({
      hasCompletedOnboarding,
      currentStep,
      totalSteps,
      completeOnboarding,
      resetOnboarding,
      setCurrentStep,
      getProgressPercentage,
    }),
    [hasCompletedOnboarding, currentStep],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};
