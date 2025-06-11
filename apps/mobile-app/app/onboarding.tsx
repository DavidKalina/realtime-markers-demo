import { OnboardingScreen } from "@/components/Onboarding/OnboardingScreen";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Onboarding() {
  return (
    <ScreenLayout>
      <GestureHandlerRootView>
        <OnboardingScreen />
      </GestureHandlerRootView>
    </ScreenLayout>
  );
}
