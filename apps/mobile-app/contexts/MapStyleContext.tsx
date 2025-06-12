import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";

const MAP_STYLE_KEY = "@map_style_preference";
const MAP_PITCH_KEY = "@map_pitch_preference";

export type MapStyleType = "light" | "dark" | "street";

interface MapStyleContextType {
  currentStyle: MapStyleType;
  setMapStyle: (style: MapStyleType) => Promise<void>;
  mapStyle: string;
  isPitched: boolean;
  togglePitch: () => Promise<void>;
}

const MapStyleContext = createContext<MapStyleContextType | undefined>(
  undefined,
);

// Memoize the style URL calculation since it's a pure function
const getMapStyleURL = (style: MapStyleType): string => {
  switch (style) {
    case "dark":
      return MapboxGL.StyleURL.Dark;
    case "street":
      return MapboxGL.StyleURL.Street;
    case "light":
      return MapboxGL.StyleURL.Light;
    default:
      return MapboxGL.StyleURL.Street;
  }
};

export const MapStyleProvider: React.FC<{ children: React.ReactNode }> =
  React.memo(({ children }) => {
    const [currentStyle, setCurrentStyle] = useState<MapStyleType>("street");
    const [isPitched, setIsPitched] = useState(false);

    // Memoize the style URL to prevent recalculation
    const mapStyle = useMemo(
      () => getMapStyleURL(currentStyle),
      [currentStyle],
    );

    // Memoize the style change handler
    const setMapStyle = useCallback(async (style: MapStyleType) => {
      try {
        await AsyncStorage.setItem(MAP_STYLE_KEY, style);
        setCurrentStyle(style);
      } catch (error) {
        console.error("Error saving map style preference:", error);
      }
    }, []);

    // Memoize the pitch toggle handler
    const togglePitch = useCallback(async () => {
      try {
        const newPitchState = !isPitched;
        await AsyncStorage.setItem(MAP_PITCH_KEY, String(newPitchState));
        setIsPitched(newPitchState);
      } catch (error) {
        console.error("Error saving map pitch preference:", error);
      }
    }, [isPitched]);

    // Load saved preferences on mount
    useEffect(() => {
      let isMounted = true;

      const loadPreferences = async () => {
        try {
          const [savedStyle, savedPitch] = await Promise.all([
            AsyncStorage.getItem(MAP_STYLE_KEY),
            AsyncStorage.getItem(MAP_PITCH_KEY),
          ]);

          if (isMounted) {
            if (
              savedStyle &&
              (savedStyle === "light" ||
                savedStyle === "dark" ||
                savedStyle === "street")
            ) {
              setCurrentStyle(savedStyle as MapStyleType);
            }
            if (savedPitch !== null) {
              setIsPitched(savedPitch === "true");
            }
          }
        } catch (error) {
          console.error("Error loading map preferences:", error);
        }
      };

      loadPreferences();

      return () => {
        isMounted = false;
      };
    }, []);

    // Memoize the context value to prevent unnecessary re-renders
    const contextValue = useMemo(
      () => ({
        currentStyle,
        setMapStyle,
        mapStyle,
        isPitched,
        togglePitch,
      }),
      [currentStyle, setMapStyle, mapStyle, isPitched, togglePitch],
    );

    return (
      <MapStyleContext.Provider value={contextValue}>
        {children}
      </MapStyleContext.Provider>
    );
  });

// Add display name for better debugging
MapStyleProvider.displayName = "MapStyleProvider";

export const useMapStyle = () => {
  const context = useContext(MapStyleContext);
  if (context === undefined) {
    throw new Error("useMapStyle must be used within a MapStyleProvider");
  }
  return context;
};
