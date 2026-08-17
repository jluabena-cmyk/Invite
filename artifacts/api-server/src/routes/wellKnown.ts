import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/.well-known/apple-app-site-association", (_req, res) => {
  const teamId = process.env["APPLE_TEAM_ID"];
  const bundleId = "com.owmo.app";

  if (!teamId) {
    logger.warn("APPLE_TEAM_ID is not set — returning empty AASA");
    res.status(503).json({ error: "APPLE_TEAM_ID not configured" });
    return;
  }

  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: ["/join/*"],
        },
      ],
    },
  };

  res.setHeader("Content-Type", "application/json");
  res.json(aasa);
});

router.get("/.well-known/assetlinks.json", (_req, res) => {
  const sha256 = process.env["ANDROID_SHA256_CERT_FINGERPRINT"];
  const packageName = "com.owmo.app";

  if (!sha256) {
    logger.warn(
      "ANDROID_SHA256_CERT_FINGERPRINT is not set — returning empty assetlinks",
    );
    res.status(503).json({ error: "ANDROID_SHA256_CERT_FINGERPRINT not configured" });
    return;
  }

  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [sha256],
      },
    },
  ];

  res.setHeader("Content-Type", "application/json");
  res.json(assetlinks);
});

export default router;
