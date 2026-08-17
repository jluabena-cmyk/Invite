/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import type { IncomingHttpHeaders } from "http";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Returns the effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 *
 * Security: we take the RIGHTMOST value, not the leftmost. With
 * app.set("trust proxy", 1) Replit's upstream proxy appends its value on
 * the right; any client-supplied value stays on the left and must be
 * ignored. Taking the leftmost value allows an attacker to inject an
 * arbitrary host, which would let them reuse CLERK_SECRET_KEY against a
 * domain they control. Taking the rightmost value is consistent with how
 * Express resolves req.hostname under the same trust-proxy setting.
 *
 * Exported so that app.ts (clerkMiddleware callback) and this proxy
 * middleware agree on which hostname is canonical — otherwise
 * multi-domain/custom-domain flows break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded)
    ? forwarded[forwarded.length - 1]
    : forwarded;
  const lastHop = raw?.split(",").pop()?.trim();
  return lastHop || req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  const skPrefix = secretKey.slice(0, 10);

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        // Take the rightmost x-forwarded-proto value — consistent with trust proxy: 1.
        // The leftmost value is client-controlled and must not be trusted.
        const rawProto = req.headers["x-forwarded-proto"];
        const protoRaw = Array.isArray(rawProto)
          ? rawProto[rawProto.length - 1]
          : rawProto;
        const protocol = protoRaw?.split(",").pop()?.trim() || "https";
        const host = getClerkProxyHost(req) || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }

        // Diagnostic: log what we're forwarding so we can confirm the proxy
        // is active and check key types (sk_test_ vs sk_live_).
        console.log(
          `[ClerkProxy] → ${proxyReq.method} ${CLERK_FAPI}${proxyReq.path}` +
          ` | Proxy-Url: ${proxyUrl}` +
          ` | SK prefix: ${skPrefix}...`
        );
      },
      proxyRes: (proxyRes) => {
        console.log(`[ClerkProxy] ← ${proxyRes.statusCode} from Clerk FAPI`);
      },
      error: (err) => {
        console.error(`[ClerkProxy] proxy error:`, err);
      },
    },
  }) as RequestHandler;
}
