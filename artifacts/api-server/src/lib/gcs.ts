const SIDECAR = "http://127.0.0.1:1106";

export function splitGcsPath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath.slice(1) : fullPath;
  const idx = normalized.indexOf("/");
  return idx === -1
    ? { bucketName: normalized, objectName: "" }
    : { bucketName: normalized.slice(0, idx), objectName: normalized.slice(idx + 1) };
}

export function gcsPathFromObjectPath(objectPath: string): { bucketName: string; objectName: string } {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  const entityId = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return splitGcsPath(`${privateObjectDir}/${entityId}`);
}

export async function signDownloadUrl(bucketName: string, objectName: string): Promise<string> {
  const body = {
    bucket_name: bucketName,
    object_name: objectName,
    method: "GET",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(), // 1-hour window
  };
  const r = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Failed to sign download URL: ${r.status}`);
  const { signed_url } = (await r.json()) as { signed_url: string };
  return signed_url;
}

export async function signedAvatarUrl(objectPath: string): Promise<string | null> {
  try {
    const { bucketName, objectName } = gcsPathFromObjectPath(objectPath);
    return await signDownloadUrl(bucketName, objectName);
  } catch {
    return null;
  }
}
