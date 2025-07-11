import React from "react";
import { MunicipalBanner } from "./MunicipalBanner";
import { useMunicipalConfig } from "@/contexts/MunicipalConfigContext";

interface LayoutWrapperProps {
  children: React.ReactNode;
  showBanner?: boolean;
  bannerClassName?: string;
  contentClassName?: string;
}

export function LayoutWrapper({
  children,
  showBanner = true,
  bannerClassName = "",
  contentClassName = "",
}: LayoutWrapperProps) {
  const { bannerConfig } = useMunicipalConfig();

  return (
    <div className="flex flex-col flex-1">
      {showBanner && (
        <MunicipalBanner config={bannerConfig} className={bannerClassName} />
      )}
      <main className={`flex-1 ${contentClassName}`}>{children}</main>
    </div>
  );
}
