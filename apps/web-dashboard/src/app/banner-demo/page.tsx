"use client";

import { LayoutWrapper } from "@/components/LayoutWrapper";
import { MunicipalBanner } from "@/components/MunicipalBanner";
import { defaultMunicipalConfigs } from "@/components/MunicipalBanner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMunicipalConfig } from "@/contexts/MunicipalConfigContext";

export default function BannerDemoPage() {
  const { updateBannerConfig } = useMunicipalConfig();

  const applyConfig = (config: any) => {
    updateBannerConfig({
      title: config.title,
      subtitle: config.subtitle,
      colors: config.colors,
    });
  };

  return (
    <LayoutWrapper>
      <div className="container mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Banner Configuration Demo
          </h1>
          <p className="text-muted-foreground">
            See how different banner configurations look across your municipal
            dashboard
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Banner</CardTitle>
            <CardDescription>
              This is how your banner currently appears across all pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MunicipalBanner config={defaultMunicipalConfigs.frederick} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Frederick Theme</CardTitle>
              <CardDescription>
                Professional gray gradient theme inspired by Frederick, CO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MunicipalBanner config={defaultMunicipalConfigs.frederick} />
              <Button
                className="w-full"
                onClick={() => applyConfig(defaultMunicipalConfigs.frederick)}
              >
                Apply Frederick Theme
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>City Theme</CardTitle>
              <CardDescription>
                Professional blue gradient theme for cities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MunicipalBanner config={defaultMunicipalConfigs.city} />
              <Button
                className="w-full"
                onClick={() => applyConfig(defaultMunicipalConfigs.city)}
              >
                Apply City Theme
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Town Theme</CardTitle>
              <CardDescription>
                Green gradient theme for towns and communities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MunicipalBanner config={defaultMunicipalConfigs.town} />
              <Button
                className="w-full"
                onClick={() => applyConfig(defaultMunicipalConfigs.town)}
              >
                Apply Town Theme
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>County Theme</CardTitle>
              <CardDescription>
                Purple gradient theme for county governments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MunicipalBanner config={defaultMunicipalConfigs.county} />
              <Button
                className="w-full"
                onClick={() => applyConfig(defaultMunicipalConfigs.county)}
              >
                Apply County Theme
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Custom Examples</CardTitle>
            <CardDescription>
              Examples of custom banner configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Solid Color Theme</h3>
              <MunicipalBanner
                config={{
                  title: "City of Innovation",
                  subtitle: "Building Tomorrow's Community",
                  colors: {
                    background: {
                      type: "solid",
                      color: "#dc2626",
                    },
                    text: "#ffffff",
                    accent: "#fbbf24",
                  },
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Diagonal Gradient</h3>
              <MunicipalBanner
                config={{
                  title: "Metropolitan District",
                  subtitle: "Serving Our Community",
                  colors: {
                    background: {
                      type: "gradient",
                      direction: "to-br",
                      stops: ["#7c2d12", "#ea580c", "#f97316"],
                    },
                    text: "#ffffff",
                    accent: "#fef3c7",
                  },
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Vertical Gradient</h3>
              <MunicipalBanner
                config={{
                  title: "Riverside Township",
                  subtitle: "Where Community Meets Nature",
                  colors: {
                    background: {
                      type: "gradient",
                      direction: "to-b",
                      stops: ["#0f766e", "#14b8a6", "#2dd4bf"],
                    },
                    text: "#ffffff",
                    accent: "#fde68a",
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/banner-config")}
          >
            Configure Your Banner
          </Button>
        </div>
      </div>
    </LayoutWrapper>
  );
}
