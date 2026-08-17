/**
 * The URL scheme for deep-linking and OAuth redirects.
 *
 * This must match the `scheme` field in app.config.js.
 * Import this constant in any file that calls
 * `AuthSession.makeRedirectUri({ scheme: ... })` so a future rename
 * only requires changing one value.
 */
export const APP_SCHEME = "owmo";
