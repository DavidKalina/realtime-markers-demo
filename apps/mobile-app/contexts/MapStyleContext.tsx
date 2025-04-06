import React, { createContext, useContext, useEffect, useState } from 'react';
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

export const MapStyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('street');

  useEffect(() => {
    // Load saved preference on mount
    const loadMapStyle = async () => {
      try {
        const savedStyle = await AsyncStorage.getItem(MAP_STYLE_KEY);
        if (savedStyle && (savedStyle === 'light' || savedStyle === 'dark' || savedStyle === 'street')) {
          setCurrentStyle(savedStyle as MapStyleType);
        }
      } catch (error) {
        console.error('Error loading map style preference:', error);
      }
    };

    loadMapStyle();
  }, []);

  const setMapStyle = async (style: MapStyleType) => {
    try {
      await AsyncStorage.setItem(MAP_STYLE_KEY, style);
      setCurrentStyle(style);
    } catch (error) {
      console.error('Error saving map style preference:', error);
    }
  };

  const getMapStyle = () => {
    switch (currentStyle) {
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

  const value = {
    currentStyle,
    setMapStyle,
    mapStyle: getMapStyle(),
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