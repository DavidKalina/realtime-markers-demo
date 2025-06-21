import React, { createContext, useContext, useState, useCallback } from "react";

interface SplashScreenContextType {
  registerLoadingState: (id: string, isLoading: boolean) => void;
  unregisterLoadingState: (id: string) => void;
  shouldShowSplash: boolean;
  setSplashAnimationFinished: (finished: boolean) => void;
  splashAnimationFinished: boolean;
}

const SplashScreenContext = createContext<SplashScreenContextType | undefined>(
  undefined,
);

export const useSplashScreen = () => {
  const context = useContext(SplashScreenContext);
  if (context === undefined) {
    throw new Error(
      "useSplashScreen must be used within a SplashScreenProvider",
    );
  }
  return context;
};

export const SplashScreenProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);

  const registerLoadingState = useCallback((id: string, isLoading: boolean) => {
    setLoadingStates((prev) => {
      const newMap = new Map(prev);
      if (isLoading) {
        newMap.set(id, true);
      } else {
        newMap.delete(id);
      }
      return newMap;
    });
  }, []);

  const unregisterLoadingState = useCallback((id: string) => {
    setLoadingStates((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  // Show splash screen if any component is loading or animation hasn't finished
  const shouldShowSplash = loadingStates.size > 0 || !splashAnimationFinished;

  return (
    <SplashScreenContext.Provider
      value={{
        registerLoadingState,
        unregisterLoadingState,
        shouldShowSplash,
        setSplashAnimationFinished,
        splashAnimationFinished,
      }}
    >
      {children}
    </SplashScreenContext.Provider>
  );
};
