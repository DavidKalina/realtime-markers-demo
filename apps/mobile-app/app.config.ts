// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "Frederick",
    slug: "mobile-app",
    version: "1.16.4",
    orientation: "portrait",
    icon: "./assets/images/frederick-logo.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    updates: {
      url: "https://u.expo.dev/ff0ebef4-f13d-442f-be77-f5818888f458",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    ios: {
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Frederick uses your location while the app is in use to center the map on your current position and improve address search results when scanning event flyers. Coordinates are sent to our server for better relevance.",
        NSLocationAlwaysUsageDescription:
          "Frederick may access your location in the background to support location-based flyer scanning and event discovery. Your coordinates are securely sent to our server to improve results.",
        NSCameraUsageDescription:
          "Frederick needs camera access to scan event flyers. Images are processed on our server and may be stored to display event details to other users.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
        UIBackgroundModes: ["remote-notification"],
      },
      supportsTablet: true,
      bundleIdentifier: "com.tenuto.mobileapp",
      buildNumber: "165",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-secure-store",
      "expo-router",
      "expo-localization",
      [
        "expo-notifications",
        {
          icon: "./assets/images/frederick-logo.png",
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
            "The app accesses your photos to let you upload them to save events.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/frederick-logo.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-contacts",
        {
          contactsPermission: "Allow $(PRODUCT_NAME) to access your contacts.",
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
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
            "Allow $(PRODUCT_NAME) to access your camera to take photos of event flyers",
          recordAudioAndroid: false,
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
