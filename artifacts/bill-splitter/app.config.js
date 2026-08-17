const productionDomain = process.env.EXPO_PUBLIC_DOMAIN;

export default {
  expo: {
    name: "Owmo",
    slug: "invite",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "owmo",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    updates: {
      url: "https://u.expo.dev/bc60ac18-3dd1-49bd-9906-16a79d2a9123",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a1f3c",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.owmo.app",
      buildNumber: "29",
      infoPlist: {
        NSCameraUsageDescription:
          "Owmo uses your camera to take photos of receipts and to scan QR codes.",
        NSPhotoLibraryUsageDescription:
          "Owmo accesses your photo library to upload receipt photos for bill splitting.",
        NSLocationWhenInUseUsageDescription:
          "Owmo uses your location to help find restaurants and venues when creating events.",
        NSContactsUsageDescription:
          "Owmo uses your contacts so you can invite friends who aren't on the app yet via text message.",
        // Required for Linking.canOpenURL() to correctly detect installed payment apps.
        // Without this, iOS always returns false for these schemes and falls back to the web.
        LSApplicationQueriesSchemes: ["venmo", "cashapp", "zellepay"],
      },
      config: {
        usesNonExemptEncryption: false,
      },
      entitlements: { "com.apple.developer.applesignin": ["Default"] },
      associatedDomains: productionDomain ? [`applinks:${productionDomain}`] : [],
    },
    android: {
      package: "com.owmo.app",
      versionCode: 29,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1a1f3c",
      },
      intentFilters: productionDomain
        ? [
            {
              action: "VIEW",
              autoVerify: true,
              data: [
                {
                  scheme: "https",
                  host: productionDomain,
                  pathPrefix: "/join",
                },
              ],
              category: ["BROWSABLE", "DEFAULT"],
            },
          ]
        : [],
    },
    web: {
      favicon: "./assets/images/icon.png",
    },
    plugins: [
      "./plugins/withPodfileSpmFix",
      [
        "expo-router",
        {
          origin: productionDomain
            ? `https://${productionDomain}/`
            : "https://localhost/",
        },
      ],
      "expo-font",
      [
        "expo-camera",
        {
          cameraPermission:
            "Owmo uses your camera to take photos of receipts and to scan QR codes.",
        },
      ],
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Owmo accesses your photo library to upload receipt photos for bill splitting.",
          cameraPermission:
            "Owmo uses your camera to take photos of receipts for bill splitting.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Owmo uses your location to help find restaurants and venues when creating events.",
        },
      ],
      [
        "expo-contacts",
        {
          contactsPermission:
            "Owmo uses your contacts so you can invite friends who aren't on the app yet via text message.",
        },
      ],
      [
        "expo-build-properties",
        {
          buildReactNativeFromSource: true,
          ios: {
            deploymentTarget: "17.0",
          },
          android: {
            packagingOptions: {
              exclude: [
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
              ],
            },
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      privacyPolicyUrl: productionDomain
        ? `https://${productionDomain}/api/privacy`
        : null,
      termsUrl: productionDomain
        ? `https://${productionDomain}/api/terms`
        : null,
      supportUrl: "mailto:support@owmo.app",
      // Stamped at build time by stage-eas-build.sh with the git HEAD SHA.
      // Accessible at runtime via Constants.expoConfig.extra.buildCommit.
      buildCommit: process.env.BUILD_COMMIT ?? null,
      eas: {
        projectId: "bc60ac18-3dd1-49bd-9906-16a79d2a9123",
      },
    },
  },
};
