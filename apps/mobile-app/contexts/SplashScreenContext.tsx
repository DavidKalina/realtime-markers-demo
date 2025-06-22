import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

interface SplashScreenContextType {
  registerLoadingState: (id: string, isLoading: boolean) => void;
  unregisterLoadingState: (id: string) => void;
  shouldShowSplash: boolean;
  setSplashAnimationFinished: (finished: boolean) => void;
  splashAnimationFinished: boolean;
  isInitialLoadComplete: boolean;
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
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const initialLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownSplashRef = useRef(false);

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

  // Track when splash has been shown to prevent multiple renders
  useEffect(() => {
    if (loadingStates.size > 0 && !hasShownSplashRef.current) {
      hasShownSplashRef.current = true;
    }
  }, [loadingStates.size]);

  // Set initial load complete after a minimum time and when all loading is done
  useEffect(() => {
    if (loadingStates.size === 0 && hasShownSplashRef.current) {
      // Ensure splash shows for at least 1.5 seconds for better UX
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }

      initialLoadTimeoutRef.current = setTimeout(() => {
        setIsInitialLoadComplete(true);
      }, 1500);
    }

    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
    };
  }, [loadingStates.size]);

  // Show splash screen only during initial load or if animation hasn't finished
  const shouldShowSplash =
    (!isInitialLoadComplete && loadingStates.size > 0) ||
    (!splashAnimationFinished && hasShownSplashRef.current);

  return (
    <SplashScreenContext.Provider
      value={{
        registerLoadingState,
        unregisterLoadingState,
        shouldShowSplash,
        setSplashAnimationFinished,
        splashAnimationFinished,
        isInitialLoadComplete,
      }}
    >
      {children}
    </SplashScreenContext.Provider>
  );
};
