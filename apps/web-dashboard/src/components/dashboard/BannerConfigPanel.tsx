"use client";

import { MunicipalBanner } from "@/components/MunicipalBanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMunicipalConfig } from "@/contexts/MunicipalConfigContext";
import { useState } from "react";

export function BannerConfigPanel() {
  const { bannerConfig, updateBannerConfig, resetToDefault } =
    useMunicipalConfig();
  const [logoUrl, setLogoUrl] = useState(bannerConfig.logo?.src || "");
  const [logoAlt, setLogoAlt] = useState(bannerConfig.logo?.alt || "");

  const handleLogoUpdate = () => {
    if (logoUrl && logoAlt) {
      updateBannerConfig({
        logo: {
          src: logoUrl,
          alt: logoAlt,
          width: 40,
          height: 40,
        },
      });
    }
  };

  const handleBackgroundTypeChange = (type: string) => {
    if (type === "solid") {
      updateBannerConfig({
        colors: {
          ...bannerConfig.colors,
          background: {
            type: "solid",
            color: "#3b82f6",
          },
        },
      });
    } else if (type === "gradient") {
      updateBannerConfig({
        colors: {
          ...bannerConfig.colors,
          background: {
            type: "gradient",
            direction: "to-r",
            stops: ["#1e40af", "#3b82f6", "#60a5fa"],
          },
        },
      });
    }
  };

  const handleGradientDirectionChange = (direction: string) => {
    if (
      bannerConfig.colors.background &&
      typeof bannerConfig.colors.background === "object" &&
      bannerConfig.colors.background.type === "gradient"
    ) {
      updateBannerConfig({
        colors: {
          ...bannerConfig.colors,
          background: {
            ...bannerConfig.colors.background,
            direction: direction as any,
          },
        },
      });
    }
  };

  const handleGradientStopsChange = (index: number, value: string) => {
    if (
      bannerConfig.colors.background &&
      typeof bannerConfig.colors.background === "object" &&
      bannerConfig.colors.background.type === "gradient"
    ) {
      const newStops = [...bannerConfig.colors.background.stops];
      newStops[index] = value;
      updateBannerConfig({
        colors: {
          ...bannerConfig.colors,
          background: {
            ...bannerConfig.colors.background,
            stops: newStops,
          },
        },
      });
    }
  };

  const handleSolidColorChange = (color: string) => {
    if (
      bannerConfig.colors.background &&
      typeof bannerConfig.colors.background === "object" &&
      bannerConfig.colors.background.type === "solid"
    ) {
      updateBannerConfig({
        colors: {
          ...bannerConfig.colors,
          background: {
            type: "solid",
            color,
          },
        },
      });
    }
  };

  const getBackgroundType = () => {
    if (typeof bannerConfig.colors.background === "string") return "solid";
    return bannerConfig.colors.background.type;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Banner Preview</CardTitle>
          <CardDescription>
            See how your banner will appear across the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MunicipalBanner config={bannerConfig} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo Configuration</CardTitle>
          <CardDescription>
            Upload and configure your municipality logo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input
                id="logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div>
              <Label htmlFor="logo-alt">Alt Text</Label>
              <Input
                id="logo-alt"
                value={logoAlt}
                onChange={(e) => setLogoAlt(e.target.value)}
                placeholder="Municipality Logo"
              />
            </div>
          </div>
          <Button onClick={handleLogoUpdate}>Update Logo</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Text Configuration</CardTitle>
          <CardDescription>
            Set the title and subtitle for your banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={bannerConfig.title}
              onChange={(e) => updateBannerConfig({ title: e.target.value })}
              placeholder="City of [Your City]"
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={bannerConfig.subtitle || ""}
              onChange={(e) => updateBannerConfig({ subtitle: e.target.value })}
              placeholder="Municipal Services Dashboard"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Configuration</CardTitle>
          <CardDescription>
            Customize the colors and gradients for your banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Background Type</Label>
            <Select
              value={getBackgroundType()}
              onValueChange={handleBackgroundTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid Color</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {getBackgroundType() === "solid" && (
            <div>
              <Label htmlFor="solid-color">Background Color</Label>
              <Input
                id="solid-color"
                type="color"
                value={
                  typeof bannerConfig.colors.background === "object" &&
                  bannerConfig.colors.background.type === "solid"
                    ? bannerConfig.colors.background.color
                    : "#3b82f6"
                }
                onChange={(e) => handleSolidColorChange(e.target.value)}
              />
            </div>
          )}

          {getBackgroundType() === "gradient" && (
            <div className="space-y-4">
              <div>
                <Label>Gradient Direction</Label>
                <Select
                  value={
                    typeof bannerConfig.colors.background === "object" &&
                    bannerConfig.colors.background.type === "gradient"
                      ? bannerConfig.colors.background.direction
                      : "to-r"
                  }
                  onValueChange={handleGradientDirectionChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to-r">To Right</SelectItem>
                    <SelectItem value="to-l">To Left</SelectItem>
                    <SelectItem value="to-t">To Top</SelectItem>
                    <SelectItem value="to-b">To Bottom</SelectItem>
                    <SelectItem value="to-tr">To Top Right</SelectItem>
                    <SelectItem value="to-tl">To Top Left</SelectItem>
                    <SelectItem value="to-br">To Bottom Right</SelectItem>
                    <SelectItem value="to-bl">To Bottom Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Gradient Colors</Label>
                <div className="grid grid-cols-3 gap-2">
                  {typeof bannerConfig.colors.background === "object" &&
                    bannerConfig.colors.background.type === "gradient" &&
                    bannerConfig.colors.background.stops.map((stop, index) => (
                      <Input
                        key={index}
                        type="color"
                        value={stop}
                        onChange={(e) =>
                          handleGradientStopsChange(index, e.target.value)
                        }
                      />
                    ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="text-color">Text Color</Label>
            <Input
              id="text-color"
              type="color"
              value={bannerConfig.colors.text}
              onChange={(e) =>
                updateBannerConfig({
                  colors: { ...bannerConfig.colors, text: e.target.value },
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="accent-color">Accent Color (Optional)</Label>
            <Input
              id="accent-color"
              type="color"
              value={bannerConfig.colors.accent || "#fbbf24"}
              onChange={(e) =>
                updateBannerConfig({
                  colors: { ...bannerConfig.colors, accent: e.target.value },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Presets</CardTitle>
          <CardDescription>
            Apply pre-configured themes for different municipality types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => resetToDefault("city")}>
              City Theme
            </Button>
            <Button variant="outline" onClick={() => resetToDefault("town")}>
              Town Theme
            </Button>
            <Button variant="outline" onClick={() => resetToDefault("county")}>
              County Theme
            </Button>
            <Button
              variant="outline"
              onClick={() => resetToDefault("frederick")}
            >
              Frederick Theme
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
