import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxGL from '@rnmapbox/maps';

const MAP_STYLE_KEY = '@map_style_preference';

export type MapStyleType = 'light' | 'dark' | 'street';

interface MapStyleContextType {
  currentStyle: MapStyleType;
  setMapStyle: (style: MapStyleType) => Promise<void>;
  mapStyle: string;
}

const MapStyleContext = createContext<MapStyleContextType | undefined>(undefined);

// Memoize the style URL calculation since it's a pure function
const getMapStyleURL = (style: MapStyleType): string => {
  switch (style) {
    case 'dark':
      return MapboxGL.StyleURL.Dark;
    case 'street':
      return MapboxGL.StyleURL.Street;
    case 'light':
      return MapboxGL.StyleURL.Light;
    default:
      return MapboxGL.StyleURL.Street;
  }
};

export const MapStyleProvider: React.FC<{ children: React.ReactNode }> = React.memo(({ children }) => {
  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('dark');

  // Memoize the style URL to prevent recalculation
  const mapStyle = useMemo(() => getMapStyleURL(currentStyle), [currentStyle]);

  // Memoize the style change handler
  const setMapStyle = useCallback(async (style: MapStyleType) => {
    try {
      await AsyncStorage.setItem(MAP_STYLE_KEY, style);
      setCurrentStyle(style);
    } catch (error) {
      console.error('Error saving map style preference:', error);
      // Consider adding error handling UI here
    }
  }, []);

  // Load saved preference on mount
  useEffect(() => {
    let isMounted = true;

    const loadMapStyle = async () => {
      try {
        const savedStyle = await AsyncStorage.getItem(MAP_STYLE_KEY);
        if (isMounted && savedStyle && (savedStyle === 'light' || savedStyle === 'dark' || savedStyle === 'street')) {
          setCurrentStyle(savedStyle as MapStyleType);
        }
      } catch (error) {
        console.error('Error loading map style preference:', error);
        // Consider adding error handling UI here
      }
    };

    loadMapStyle();

    return () => {
      isMounted = false;
    };
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    currentStyle,
    setMapStyle,
    mapStyle,
  }), [currentStyle, setMapStyle, mapStyle]);

  return <MapStyleContext.Provider value={contextValue}>{children}</MapStyleContext.Provider>;
});

// Add display name for better debugging
MapStyleProvider.displayName = 'MapStyleProvider';

export const useMapStyle = () => {
  const context = useContext(MapStyleContext);
  if (context === undefined) {
    throw new Error('useMapStyle must be used within a MapStyleProvider');
  }
  return context;
}; 