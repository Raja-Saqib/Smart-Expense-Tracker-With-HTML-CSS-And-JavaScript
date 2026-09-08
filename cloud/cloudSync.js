import { CLOUD_CONFIG } from "../config.js";

const CLOUD_KEY = CLOUD_CONFIG.CLOUD_KEY;

const CLOUD_URL = CLOUD_CONFIG.CLOUD_URL;

/**
 * Pushes data to the cloud.
 * 
 * @param {string|null} blobId - The unique ID of the JSON blob (e.g. stored in localStorage). If null, a new blob is created automatically.
 * @returns 
 */
export const pushToCloud = async ({
  transactions,
  cloudMeta,
  chartMode,
  deviceId,
  meta = {},
  blobId = null,
}) => {
  const payload = {
    version: (cloudMeta?.version ?? 0) + 1,
    updatedAt: Date.now(),
    updatedBy: deviceId,
    transactions,
    chartMode,
    meta
  };

  // Determine if we are creating a new blob (POST) or updating an existing one (PUT)
  const isNew = !blobId;
  const url = isNew ? CLOUD_URL : `${CLOUD_URL}/${blobId}`;
  const method = isNew ? "POST" : "PUT";

  const res = await fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = new Error(
      `Cloud push failed: HTTP ${res.status}`
    );

    error.status = res.status;

    throw error;
  }

  // If it's a new creation, JSON Blob returns the new URL in the "Location" response header
  let newBlobId = blobId;
  if (isNew) {
    const locationHeader = res.headers.get("Location");
    // Example header: https://jsonblob.com
    newBlobId = locationHeader.split("/").pop();
  }

  return { 
    payload, 
    blobId: newBlobId // Return the ID so the main application can save it to localStorage
  };
};
 /**
  * Pulls data from the cloud using a speciic blobId
  * 
  */
export const pullFromCloud = async (blobId) => {
  if (!blobId) {
    console.warn("Pull aborted: No blobId provided.");
    return null;
  }

  try {
    let res;
  
    // FETCH ERROR HANDLING
    try {
      res = await fetch(`${CLOUD_URL}/${blobId}`);
    } catch (error) {
      console.warn("Cloud pull failed:", error);
  
      return null;
    }
  
    // HTTP ERROR HANDLING
    if (!res.ok) {
      console.warn(
        `Cloud pull failed: HTTP ${res.status} ${res.statusText}`
      );
  
      return null;
    }
  
    let data;
  
    // JSON ERROR HANDLING
    try {
      data = await res.json();
    } catch (error) {
      console.warn("Cloud response is not valid JSON:", error);
  
      return null;
    }
  
    // RESPONSE VALIDATION
    if (
      !data ||
      !Array.isArray(data.transactions)
    ) {
      console.warn("Invalid cloud data shape");
  
      return null;
    }
  
    // VERSION VALIDATION
    if (
      !Number.isInteger(data.version) ||
      data.version < 0
    ) {
      console.warn("Invalid cloud version");
  
      return null;
    }
  
    // UPDATED AT VALIDATION
    if (
      !Number.isFinite(data.updatedAt) ||
      data.updatedAt < 0
    ) {
      console.warn("Invalid cloud updatedAt");
  
      return null;
    }
  
    // CHART MODE VALIDATION
    if (
      data.chartMode !== "pie" &&
      data.chartMode !== "donut"
    ) {
      console.warn("Invalid cloud chart mode");
  
      return null;
    }
  
    return data;
  } catch (error) {
    console.warn(
      "Cloud pull unavailable:",
      error
    );

    return null;
  }

};

export const detectConflicts = (
  local,
  remote
) => {
  const conflicts = [];

  const localMap = new Map(local.map(t => [t.id, t]));

  for (const r of remote) {
    const l = localMap.get(r.id);

    if (!l) continue;

    if (
      l.updatedAt !== r.updatedAt &&
      l.updatedBy !== r.updatedBy
    ) {
      conflicts.push({
        id: r.id,
        local: l,
        remote: r
      });
    }
  }

  return conflicts;
};

export const autoResolveConflicts = conflicts => {
  const resolved = [];
  const unresolved = [];

  for (const c of conflicts) {
    const { local, remote } = c;

    if (local.category === remote.category) {
      resolved.push(
        local.updatedAt > remote.updatedAt
          ? local
          : remote
      );
    } else {
      unresolved.push(c);
    }
  }

  return { resolved, unresolved };
};
