import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 client (S3-compatible).
 * Reads credentials from environment variables.
 * Throws clear errors if any required variable is missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

// Lazy singleton — created on first access, not at module load.
// This avoids crashing the app at startup if env vars are missing in some environments.
let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  _r2Client = new S3Client({
    region: "auto", // R2 doesn't use regions like AWS, "auto" is the convention
    endpoint: requireEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  return _r2Client;
}

export function getR2Bucket(): string {
  return requireEnv("R2_BUCKET_NAME");
}

export function getR2PublicUrl(): string {
  return requireEnv("R2_PUBLIC_URL").replace(/\/+$/, ""); // strip trailing slashes
}

/**
 * Generates a presigned URL for uploading a single object to R2.
 * The browser uploads directly to R2 using this URL — server never sees the bytes.
 *
 * @param key Object key (path inside the bucket), e.g. "properties/abc123/photo-1.jpg"
 * @param contentType MIME type of the file being uploaded, e.g. "image/jpeg"
 * @param expiresInSeconds How long the URL is valid (default 5 minutes)
 * @returns Presigned URL string the browser can PUT to
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

/**
 * Deletes an object from R2.
 * @param key Object key to delete
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  });
  await getR2Client().send(command);
}

/**
 * Constructs the public URL where a given key can be viewed in the browser.
 * @param key Object key
 * @returns Full public URL
 */
export function publicUrlForKey(key: string): string {
  return `${getR2PublicUrl()}/${key.replace(/^\/+/, "")}`;
}

/**
 * Performs a connectivity check against the bucket.
 * Returns ok=true if the bucket is reachable and credentials are valid.
 */
export async function r2HealthCheck(): Promise<{
  ok: boolean;
  bucket: string;
  endpoint: string;
  publicUrl: string;
  error?: string;
}> {
  const bucket = getR2Bucket();
  const endpoint = process.env.R2_ENDPOINT || "(not set)";
  const publicUrl = process.env.R2_PUBLIC_URL || "(not set)";

  try {
    await getR2Client().send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, bucket, endpoint, publicUrl };
  } catch (err: any) {
    return {
      ok: false,
      bucket,
      endpoint,
      publicUrl,
      error: err?.name ? `${err.name}: ${err.message}` : String(err),
    };
  }
}
