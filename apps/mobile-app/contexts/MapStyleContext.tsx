import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxGL from '@rnmapbox/maps';

const MAP_STYLE_KEY = '@map_style_preference';

interface MapStyleContextType {
  isDarkMode: boolean;
  toggleMapStyle: () => Promise<void>;
  mapStyle: string;
}

const MapStyleContext = createContext<MapStyleContextType | undefined>(undefined);

export const MapStyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load saved preference on mount
    const loadMapStyle = async () => {
      try {
        const savedStyle = await AsyncStorage.getItem(MAP_STYLE_KEY);
        setIsDarkMode(savedStyle === 'dark');
      } catch (error) {
        console.error('Error loading map style preference:', error);
      }
    };

    loadMapStyle();
  }, []);

  const toggleMapStyle = async () => {
    try {
      const newMode = !isDarkMode;
      await AsyncStorage.setItem(MAP_STYLE_KEY, newMode ? 'dark' : 'light');
      setIsDarkMode(newMode);
    } catch (error) {
      console.error('Error saving map style preference:', error);
    }
  };

  const value = {
    isDarkMode,
    toggleMapStyle,
    mapStyle: isDarkMode ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Light,
  };

  return <MapStyleContext.Provider value={value}>{children}</MapStyleContext.Provider>;
};

export const useMapStyle = () => {
  const context = useContext(MapStyleContext);
  if (context === undefined) {
    throw new Error('useMapStyle must be used within a MapStyleProvider');
  }
  return context;
}; 