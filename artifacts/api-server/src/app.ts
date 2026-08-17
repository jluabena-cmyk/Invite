import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import wellKnownRouter from "./routes/wellKnown";
import { logger } from "./lib/logger";
import { errorRateTracker } from "./middleware/errorRateTracker";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { initSentry, Sentry } from "./lib/sentry";

if (process.env["NODE_ENV"] === "production") {
  initSentry();
}

const app: Express = express();

// Trust Replit's single reverse-proxy hop so that req.ip reflects the actual
// client IP derived from X-Forwarded-For, rather than the proxy's address.
// Without this, X-Forwarded-For is ignored and per-IP rate limiting is useless.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use(wellKnownRouter);

app.get("/api/dl/owmo-src", (_req: Request, res: Response) => {
  const filePath = path.resolve("/home/runner/workspace/owmo-build.tar.gz");
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="owmo-build.tar.gz"');
  res.setHeader("Content-Type", "application/gzip");
  res.sendFile(filePath);
});

app.use("/api", errorRateTracker);
app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled route error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
