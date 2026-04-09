import { getDownloadURL, getStorage, ref as storageRef } from "firebase/storage";
import { app, storage } from "../../constants/firebaseConfig";
import { readCachedJson, writeCachedJson } from "./dataCache";

const IMAGE_URL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_URL_MISSING_SENTINEL = "__missing__";
const DEFAULT_BUCKET = storage?.app?.options?.storageBucket || "gojo-education.firebasestorage.app";
const BUCKET_ALIASES = {
  "bale-house-rental.appspot.com": DEFAULT_BUCKET,
  "bale-house-rental.firebasestorage.app": DEFAULT_BUCKET,
  "gojo-education.appspot.com": DEFAULT_BUCKET,
};

function normalizeBucketName(bucket) {
  return BUCKET_ALIASES[String(bucket || "").trim()] || String(bucket || "").trim();
}

function extractFromGoogleStorageUrl(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (parsedUrl.hostname === "storage.googleapis.com" && pathParts.length >= 2) {
      return {
        bucket: pathParts[0],
        objectPath: decodeURIComponent(pathParts.slice(1).join("/")),
      };
    }

    if (parsedUrl.hostname === "firebasestorage.googleapis.com") {
      const match = parsedUrl.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
      if (match) {
        return {
          bucket: decodeURIComponent(match[1]),
          objectPath: decodeURIComponent(match[2]),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractFromGsUrl(rawUrl) {
  const match = String(rawUrl || "").match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (!match) return null;

  return {
    bucket: match[1],
    objectPath: decodeURIComponent(match[2]),
  };
}

function extractStorageLocation(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  return extractFromGoogleStorageUrl(rawUrl) || extractFromGsUrl(rawUrl) || null;
}

export function shouldDeferFirebaseImageLoad(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return false;
  if (/^gs:\/\//i.test(trimmedUrl)) return true;
  if (trimmedUrl.includes("storage.googleapis.com/")) return true;
  if (trimmedUrl.includes("firebasestorage.googleapis.com/") && !/[?&]token=/.test(trimmedUrl)) {
    return true;
  }

  const storageLocation = extractStorageLocation(trimmedUrl);
  if (!storageLocation) return false;

  return normalizeBucketName(storageLocation.bucket) !== storageLocation.bucket;
}

function looksResolvableStorageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  if (/^gs:\/\//i.test(rawUrl)) return true;
  if (rawUrl.includes("storage.googleapis.com/")) return true;
  if (rawUrl.includes("firebasestorage.googleapis.com/") && !/[?&]token=/.test(rawUrl)) return true;

  const location = extractStorageLocation(rawUrl);
  if (!location) return false;

  return normalizeBucketName(location.bucket) !== location.bucket;
}

async function resolveFromBucket(bucket, objectPath) {
  const targetBucket = normalizeBucketName(bucket);
  const cacheKey = `cache:imageUrl:${targetBucket}:${encodeURIComponent(objectPath)}`;
  const cached = await readCachedJson(cacheKey, IMAGE_URL_CACHE_TTL_MS);
  if (cached === IMAGE_URL_MISSING_SENTINEL) return null;
  if (typeof cached === "string" && cached.trim()) return cached;

  const targetStorage = targetBucket === DEFAULT_BUCKET ? storage : getStorage(app, `gs://${targetBucket}`);
  try {
    const downloadUrl = await getDownloadURL(storageRef(targetStorage, objectPath));
    writeCachedJson(cacheKey, downloadUrl).catch(() => {});
    return downloadUrl;
  } catch {
    writeCachedJson(cacheKey, IMAGE_URL_MISSING_SENTINEL).catch(() => {});
    return null;
  }
}

export async function resolveFirebaseImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  const storageLocation = extractStorageLocation(trimmedUrl);
  if (!storageLocation || !looksResolvableStorageUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  try {
    const resolvedUrl = await resolveFromBucket(storageLocation.bucket, storageLocation.objectPath);
    if (resolvedUrl) return resolvedUrl;
    return null;
  } catch {
    return null;
  }
}
