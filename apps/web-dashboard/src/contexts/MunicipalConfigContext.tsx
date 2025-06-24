"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { MunicipalBannerConfig } from "@/components/MunicipalBanner";
import { defaultMunicipalConfigs } from "@/components/MunicipalBanner";

interface MunicipalConfigContextType {
  bannerConfig: MunicipalBannerConfig;
  updateBannerConfig: (config: Partial<MunicipalBannerConfig>) => void;
  resetToDefault: (type: keyof typeof defaultMunicipalConfigs) => void;
}

const MunicipalConfigContext = createContext<
  MunicipalConfigContextType | undefined
>(undefined);

interface MunicipalConfigProviderProps {
  children: ReactNode;
  initialConfig?: MunicipalBannerConfig;
}

export function MunicipalConfigProvider({
  children,
  initialConfig,
}: MunicipalConfigProviderProps) {
  const [bannerConfig, setBannerConfig] = useState<MunicipalBannerConfig>(
    initialConfig || {
      ...defaultMunicipalConfigs.frederick,
      title: "Town of Frederick",
      subtitle: "Built on what matters",
      colors: {
        background: "#00697A", // Matching login page background
        text: "#FFFFFF",
        accent: "#FDB813", // Golden accent from mobile app
      },
      logo: {
        src: "/frederick-logo.svg",
        alt: "Town of Frederick Logo",
        width: 80,
        height: 80,
      },
    },
  );

  const updateBannerConfig = (config: Partial<MunicipalBannerConfig>) => {
    setBannerConfig((prev) => ({ ...prev, ...config }));
  };

  const resetToDefault = (type: keyof typeof defaultMunicipalConfigs) => {
    setBannerConfig((prev) => ({
      ...defaultMunicipalConfigs[type],
      logo: prev.logo, // Keep existing logo
    }));
  };

  return (
    <MunicipalConfigContext.Provider
      value={{
        bannerConfig,
        updateBannerConfig,
        resetToDefault,
      }}
    >
      {children}
    </MunicipalConfigContext.Provider>
  );
}

export function useMunicipalConfig() {
  const context = useContext(MunicipalConfigContext);
  if (context === undefined) {
    throw new Error(
      "useMunicipalConfig must be used within a MunicipalConfigProvider",
    );
  }
  return context;
}
