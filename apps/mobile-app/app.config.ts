// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "MapMoji",
    slug: "mobile-app",
    version: "1.3.1",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
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
          "MapMoji needs your location to show you nearby content",
        NSLocationAlwaysUsageDescription: "MapMoji needs your location to show you nearby content",
        NSCameraUsageDescription: "MapMoji needs camera access to let you take photos",
        NSMicrophoneUsageDescription: "MapMoji needs microphone access for video recording",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      supportsTablet: true,
      bundleIdentifier: "com.tenuto.mobileapp",
      buildNumber: "32",
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
      "expo-router",
      "expo-localization",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash.png",
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
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
          microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone",
          recordAudioAndroid: true,
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
    },
  },
};
