import { CLOUD_CONFIG } from "../config.js";

const CLOUD_META_KEY = CLOUD_CONFIG.CLOUD_META_KEY;

export const STORAGE_SYNC_KEY = CLOUD_CONFIG.STORAGE_SYNC_KEY;

const DEFAULT_CLOUD_META = {
  version: 0,
  updatedAt: 0,
  deviceId: null,
  blobId: null
};

// --------------------------------------------------
// Validation helpers
// --------------------------------------------------

const isValidBlobId = value =>
  typeof value === "string" &&
  value.trim() !== "";

const normalizeBlobId = value =>
  isValidBlobId(value)
    ? value.trim()
    : DEFAULT_CLOUD_META.blobId;

const normalizeCloudMeta = meta => ({
  version: Number.isFinite(meta?.version)
    ? meta.version
    : DEFAULT_CLOUD_META.version,

  updatedAt: Number.isFinite(meta?.updatedAt)
    ? meta.updatedAt
    : DEFAULT_CLOUD_META.updatedAt,

  deviceId:
    typeof meta?.deviceId === "string" &&
    meta.deviceId.trim() !== ""
      ? meta.deviceId
      : DEFAULT_CLOUD_META.deviceId,

  blobId: normalizeBlobId(meta?.blobId)
});

// --------------------------------------------------
// Load persisted cloud metadata
// --------------------------------------------------

let cloudMeta = (() => {
  try {
    const stored =
      localStorage.getItem(CLOUD_META_KEY);

    if (!stored) {
      return { ...DEFAULT_CLOUD_META };
    }

    const parsed = JSON.parse(stored);

    return normalizeCloudMeta(parsed);

  } catch {
    return { ...DEFAULT_CLOUD_META };
  }
})();

// --------------------------------------------------
// Read cloud metadata
// --------------------------------------------------

export const getCloudMeta = () =>
  structuredClone(cloudMeta);

// --------------------------------------------------
// Write cloud metadata
// --------------------------------------------------

export const setCloudMeta = meta => {
  cloudMeta = normalizeCloudMeta(meta);

  localStorage.setItem(
    CLOUD_META_KEY,
    JSON.stringify(cloudMeta)
  );

  return getCloudMeta();
};

// --------------------------------------------------
// Blob ID helpers
// --------------------------------------------------

export const getBlobId = () =>
  cloudMeta.blobId;

export const setBlobId = blobId => {
  cloudMeta = {
    ...cloudMeta,
    blobId: normalizeBlobId(blobId)
  };

  localStorage.setItem(
    CLOUD_META_KEY,
    JSON.stringify(cloudMeta)
  );

  return cloudMeta.blobId;
};
