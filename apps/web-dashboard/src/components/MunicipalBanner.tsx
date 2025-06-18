import React from "react";
import Image from "next/image";

export interface MunicipalBannerConfig {
  logo?: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  };
  title: string;
  subtitle?: string;
  colors: {
    background:
      | string
      | {
          type: "gradient";
          direction:
            | "to-r"
            | "to-l"
            | "to-t"
            | "to-b"
            | "to-tr"
            | "to-tl"
            | "to-br"
            | "to-bl";
          stops: string[];
        }
      | {
          type: "solid";
          color: string;
        };
    text: string;
    accent?: string;
  };
  height?: "sm" | "md" | "lg";
  showDivider?: boolean;
}

interface MunicipalBannerProps {
  config: MunicipalBannerConfig;
  className?: string;
}

export function MunicipalBanner({
  config,
  className = "",
}: MunicipalBannerProps) {
  const {
    logo,
    title,
    subtitle,
    colors,
    height = "md",
    showDivider = true,
  } = config;

  // Frederick theme detection
  const isFrederick = title.toLowerCase().includes("frederick");

  // Height classes
  const heightClasses = {
    sm: "h-12",
    md: "h-16",
    lg: "h-20",
  };

  if (isFrederick) {
    return (
      <div
        className={`w-full flex items-center justify-between ${heightClasses[height]} px-4 shadow-sm ${className}`}
        style={{
          background:
            typeof colors.background === "string"
              ? colors.background
              : "#f9fafb",
          minHeight: 0,
        }}
      >
        <div className="flex items-center space-x-3">
          {logo && (
            <Image
              src={logo.src}
              alt={logo.alt}
              width={logo.width || 32}
              height={logo.height || 32}
              className="object-contain"
            />
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg" style={{ color: colors.text }}>
              {title}
            </span>
            {subtitle && (
              <span
                className="text-xs"
                style={{ color: (colors as any).subtitle || colors.text }}
              >
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div
          className="h-10 w-1 rounded-full"
          style={{ backgroundColor: colors.accent || "#f59e0b" }}
        />
      </div>
    );
  }

  // Default/other themes
  const getBackgroundStyle = () => {
    if (typeof colors.background === "string") {
      return { backgroundColor: colors.background };
    }

    if (colors.background.type === "gradient") {
      const gradientStops = colors.background.stops.join(", ");
      return {
        background: `linear-gradient(${colors.background.direction}, ${gradientStops})`,
      };
    }

    return { backgroundColor: colors.background.color };
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`${heightClasses[height]} w-full flex items-center justify-between px-6 shadow-sm`}
        style={getBackgroundStyle()}
      >
        <div className="flex items-center space-x-4">
          {logo && (
            <div className="flex-shrink-0">
              <Image
                src={logo.src}
                alt={logo.alt}
                width={logo.width || 40}
                height={logo.height || 40}
                className="object-contain"
              />
            </div>
          )}
          <div className="flex flex-col">
            <h1
              className="text-xl font-bold leading-tight"
              style={{ color: colors.text }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="text-sm opacity-90 leading-tight"
                style={{ color: colors.text }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {colors.accent && (
          <div
            className="w-1 h-12 rounded-full"
            style={{ backgroundColor: colors.accent }}
          />
        )}
      </div>

      {showDivider && (
        <div
          className="h-px w-full"
          style={{
            background: colors.accent
              ? `linear-gradient(to-r, transparent, ${colors.accent}, transparent)`
              : "linear-gradient(to-r, transparent, rgba(0,0,0,0.1), transparent)",
          }}
        />
      )}
    </div>
  );
}

// Default configurations for different municipality types
export const defaultMunicipalConfigs = {
  frederick: {
    title: "Town of Frederick",
    subtitle: "Colorado",
    colors: {
      background: "#e0f2fe", // light blue
      text: "#222",
      accent: "#f59e0b", // orange
    },
  },
  city: {
    title: "City of [Your City]",
    subtitle: "Municipal Services Dashboard",
    colors: {
      background: {
        type: "gradient" as const,
        direction: "to-r" as const,
        stops: ["#1e40af", "#3b82f6", "#60a5fa"],
      },
      text: "#ffffff",
      accent: "#fbbf24",
    },
  },
  town: {
    title: "Town of [Your Town]",
    subtitle: "Community Services Portal",
    colors: {
      background: {
        type: "gradient" as const,
        direction: "to-r" as const,
        stops: ["#059669", "#10b981", "#34d399"],
      },
      text: "#ffffff",
      accent: "#f59e0b",
    },
  },
  county: {
    title: "[Your County] County",
    subtitle: "County Government Services",
    colors: {
      background: {
        type: "gradient" as const,
        direction: "to-r" as const,
        stops: ["#7c3aed", "#8b5cf6", "#a78bfa"],
      },
      text: "#ffffff",
      accent: "#ec4899",
    },
  },
};
