// app.config.ts
import "dotenv/config";

export default {
  expo: {
    name: "MapMoji",
    slug: "mobile-app",
    version: "1.11.1",
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
          "MapMoji uses your location to find the nearest address when you scan an event flyer, and to center the map on your current position",
        NSLocationAlwaysUsageDescription:
          "MapMoji uses your location to find the nearest address when you scan an event flyer, and to center the map on your current position",
        NSCameraUsageDescription:
          "MapMoji needs camera access to take photos of event flyers and add them to the map",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
      },
      supportsTablet: true,
      bundleIdentifier: "com.tenuto.mobileapp",
      buildNumber: "110",
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
          photosPermission: "The app accesses your photos to let you upload them to save events.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo.png",
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
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.com.mapmoji.app",
          enableGooglePay: false,
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
    },
  },
};
