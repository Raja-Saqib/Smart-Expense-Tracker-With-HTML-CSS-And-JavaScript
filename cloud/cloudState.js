const CLOUD_META_KEY = "cloudMeta";

export const STORAGE_SYNC_KEY = "expenseTrackerSyncState";

const DEFAULT_CLOUD_META = {
  version: 0,
  updatedAt: 0,
  deviceId: null
};

let cloudMeta = (() => {
  try {
    const stored = localStorage.getItem(CLOUD_META_KEY);

    if (!stored) {
      return { ...DEFAULT_CLOUD_META };
    }

    const parsed = JSON.parse(stored);

    return {
      version: Number.isFinite(parsed?.version)
        ? parsed.version
        : DEFAULT_CLOUD_META.version,

      updatedAt: Number.isFinite(parsed?.updatedAt)
        ? parsed.updatedAt
        : DEFAULT_CLOUD_META.updatedAt,

      deviceId: parsed?.deviceId ?? DEFAULT_CLOUD_META.deviceId
    };
  } catch {
    return { ...DEFAULT_CLOUD_META };
  }
})();

export const getCloudMeta = () => cloudMeta;

export const setCloudMeta = meta => {
  cloudMeta = {
    version: Number.isFinite(meta?.version)
      ? meta.version
      : DEFAULT_CLOUD_META.version,

    updatedAt: Number.isFinite(meta?.updatedAt)
      ? meta.updatedAt
      : DEFAULT_CLOUD_META.updatedAt,

    deviceId: meta?.deviceId ?? DEFAULT_CLOUD_META.deviceId
  };

  localStorage.setItem(
    CLOUD_META_KEY,
    JSON.stringify(cloudMeta)
  );
};
