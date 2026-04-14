// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "Sidequests",
    slug: "mobile-app",
    version: "2.3.0",
    orientation: "portrait",
    icon: "./assets/app-icon-deck.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/ff0ebef4-f13d-442f-be77-f5818888f458",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    ios: {
      // Icon Composer .icon directory for glass effect (SDK 54+)
      icon: "./assets/sidequests.icon",
      infoPlist: {
        CFBundleDisplayName: "Sidequests",
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Sidequests uses your location to find nearby places for your adventures and track your progress on active quests.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Sidequests may access your location in the background to notify you when you're near a quest objective.",
        NSLocationAlwaysUsageDescription:
          "Sidequests may access your location in the background to notify you when you're near a quest objective.",
        NSCalendarsUsageDescription:
          "Sidequests can add your planned adventures to your calendar so you never miss an outing.",
        NSCalendarsWriteOnlyAccessUsageDescription:
          "Sidequests can add your planned adventures to your calendar so you never miss an outing.",
        NSCameraUsageDescription:
          "Sidequests uses your camera to capture photos during your adventures.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
        UIBackgroundModes: ["remote-notification", "location"],
      },
      supportsTablet: true,
      bundleIdentifier: "com.tenuto.mobileapp",
      buildNumber: "289",
    },
    android: {
      label: "Sidequests",
      adaptiveIcon: {
        foregroundImage: "./assets/app-icon-deck.png",
        backgroundColor: "#ffffff",
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
        },
      ],
      "expo-asset",
      "expo-font",
      "expo-secure-store",
      "expo-router",
      "expo-localization",
      "expo-web-browser",
      "expo-task-manager",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff",
          defaultChannel: "default",
          enableBackgroundRemoteNotifications: true,
        },
      ],
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Sidequests accesses your photos to let you add images to your adventures.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/app-icon-deck.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to use your location.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow $(PRODUCT_NAME) to access your camera to capture photos during adventures",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-calendar",
        {
          calendarPermission:
            "Sidequests can add your planned adventures to your calendar so you never miss an outing.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: "ff0ebef4-f13d-442f-be77-f5818888f458",
      },
      expoProjectId: "ff0ebef4-f13d-442f-be77-f5818888f458",
    },
  },
};
