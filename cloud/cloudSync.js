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

const VALID_CATEGORIES = new Set([
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Income",
  "Other"
]);

export const isValidTransaction = transaction => {
  if (
    !transaction ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return false;
  }

  // id
  if (
    !Number.isInteger(transaction.id) ||
    transaction.id < 0
  ) {
    return false;
  }

  // text / description
  if (typeof transaction.text !== "string") {
    return false;
  }

  // category
  if (
    typeof transaction.category !== "string" ||
    !VALID_CATEGORIES.has(transaction.category)
  ) {
    return false;
  }

  // amount
  if (
    typeof transaction.amount !== "number" ||
    !Number.isFinite(transaction.amount) ||
    transaction.amount === 0
  ) {
    return false;
  }

  // date
  if (
    typeof transaction.date !== "string" ||
    Number.isNaN(Date.parse(transaction.date))
  ) {
    return false;
  }

  // updatedAt
  if (
    !Number.isFinite(transaction.updatedAt) ||
    transaction.updatedAt < 0
  ) {
    return false;
  }

  // updatedBy
  if (
    typeof transaction.updatedBy !== "string" ||
    transaction.updatedBy.trim() === ""
  ) {
    return false;
  }

  return true;
};

export const isValidCloudPayload = data => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return false;
  }

  // updatedBy
  if (
    typeof data.updatedBy !== "string" ||
    data.updatedBy.trim() === ""
  ) {
    return false;
  }

  // version
  if (
    !Number.isInteger(data.version) ||
    data.version < 0
  ) {
    return false;
  }

  // updatedAt
  if (
    !Number.isFinite(data.updatedAt) ||
    data.updatedAt < 0
  ) {
    return false;
  }

  // chartMode
  if (
    data.chartMode !== "pie" &&
    data.chartMode !== "donut"
  ) {
    return false;
  }

  // transactions container
  if (!Array.isArray(data.transactions)) {
    return false;
  }

  // Every transaction must be valid
  if (
    !data.transactions.every(isValidTransaction)
  ) {
    return false;
  }

  return true;
};

const createTimeoutSignal = (
  timeout,
  callerSignal
) => {
  const controller = new AbortController();

  let timeoutId = setTimeout(
    () => controller.abort("timeout"),
    timeout
  );

  const abortFromCaller = () => {
    controller.abort("caller");
  };

  callerSignal?.addEventListener(
    "abort",
    abortFromCaller,
    { once: true }
  );

  return {
    signal: controller.signal,

    cleanup: () => {
      clearTimeout(timeoutId);

      callerSignal?.removeEventListener(
        "abort",
        abortFromCaller
      );
    }
  };
};

const CLOUD_PULL_TIMEOUT = 10_000;

const createPullSignal = (
  timeout,
  callerSignal
) => {
  // Modern browsers
  if (
    typeof AbortSignal?.timeout === "function" &&
    typeof AbortSignal?.any === "function"
  ) {
    const timeoutSignal =
      AbortSignal.timeout(timeout);

    const signal = callerSignal
      ? AbortSignal.any([
          timeoutSignal,
          callerSignal
        ])
      : timeoutSignal;

    return {
      signal,
      cleanup: () => {}
    };
  }

  // Compatibility fallback
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort("timeout"),
    timeout
  );

  const abortFromCaller = () => {
    controller.abort("caller");
  };

  callerSignal?.addEventListener(
    "abort",
    abortFromCaller,
    { once: true }
  );

  return {
    signal: controller.signal,

    cleanup: () => {
      clearTimeout(timeoutId);

      callerSignal?.removeEventListener(
        "abort",
        abortFromCaller
      );
    }
  };
};

 /**
  * Pulls data from the cloud using a speciic blobId 
  * 
  */ 
export const pullFromCloud = async (blobId, {
  signal: callerSignal
} = {}) => {
  if (!blobId) {
    console.warn("Pull aborted: No blobId provided.");
    return null;
  }

  const {
    signal,
    cleanup
  } = createPullSignal(
    CLOUD_PULL_TIMEOUT,
    callerSignal
  );

  try {
    let res;
  
    // FETCH ERROR HANDLING 
    try {
      // Caller already cancelled
      if (callerSignal?.aborted) {
        console.warn("Cloud pull cancelled by caller");
        return null;
      }

      res = await fetch(`${CLOUD_URL}/${blobId}`, {
        signal
      });
    } catch (error) {
      if (callerSignal?.aborted) {
        console.warn("Cloud pull cancelled by caller");
      } else if (
        error?.name === "TimeoutError"
      ) {
        console.warn("Cloud pull timed out");
      } else if (
        error?.name === "AbortError"
      ) {
        console.warn("Cloud pull aborted");
      } else {
        console.warn("Cloud pull failed:", error);
      }

      return null;
    } finally {
      cleanup();
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
      console.warn(
        "Cloud response is not valid JSON:",
        error
      );
  
      return null;
    }
  
    // FULL RESPONSE VALIDATION
    if (!isValidCloudPayload(data)) {
      console.warn("Invalid cloud payload");
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
