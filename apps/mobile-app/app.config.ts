// app.config.ts
import "dotenv/config";
import baseConfig from "./app.json";

module.exports = {
  expo: {
    ...baseConfig.expo,
    plugins: [
      ...baseConfig.expo.plugins,
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
          mapboxAccessToken: process.env.MAPBOX_PUBLIC_TOKEN,
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location.",
        },
      ],
    ],
  },
};
