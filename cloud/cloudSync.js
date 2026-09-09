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

    if (!locationHeader) {
      throw new Error(
        "Cloud blob was created but no Location header was returned"
      );
    }

    const parsedBlobId = locationHeader
      .split("/")
      .filter(Boolean)
      .pop();

    if (!parsedBlobId) {
      throw new Error(
        "Cloud blob was created but blobId could not be determined"
      );
    }

    newBlobId = parsedBlobId;
  }

  return {
    ...payload,
    blobId: newBlobId
  };
};

const isJSONValue = value => {
  try {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return true;
    }

    if (typeof value === "number") {
      return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
      return value.every(isJSONValue);
    }

    if (
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      return Object.values(value).every(isJSONValue);
    }

    return false;
  } catch {
    return false;
  }
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

const TRANSACTION_FIELDS = new Set([
  "id",
  "text",
  "category",
  "amount",
  "date",
  "updatedAt",
  "updatedBy"
]);

const MAX_TEXT_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 50;

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);

const isStrictISODateString = value => {
  if (typeof value !== "string") {
    return false;
  }

  // Require full ISO-8601 UTC timestamp:
  // 2026-09-08T06:21:39.123Z
  const ISO_UTC_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!ISO_UTC_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  // Reject impossible dates that Date.parse() may normalize.
  return new Date(timestamp).toISOString() === value;
};

export const validateTransaction = transaction => {
  // -----------------------------------------
  // Boundary: only accept JSON-shaped objects
  // -----------------------------------------

  if (!isJSONValue(transaction)) {
    return {
      valid: false,
      errors: {
        transaction:
          "Transaction must contain only JSON-compatible values"
      }
    };
  }

  if (
    transaction === null ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return {
      valid: false,
      errors: {
        transaction:
          "Transaction must be a JSON object"
      }
    };
  }

  const errors = {};

  // -----------------------------------------
  // Unknown fields
  // -----------------------------------------

  for (const key of Object.keys(transaction)) {
    if (!TRANSACTION_FIELDS.has(key)) {
      errors[key] = "Unknown transaction field";
    }
  }

  // -----------------------------------------
  // Required fields
  // -----------------------------------------

  for (const field of TRANSACTION_FIELDS) {
    if (!hasOwn(transaction, field)) {
      errors[field] = "Required field is missing";
    }
  }

  // -----------------------------------------
  // id
  // -----------------------------------------

  if (hasOwn(transaction, "id")) {
    if (
      !Number.isSafeInteger(transaction.id) ||
      transaction.id < 0
    ) {
      errors.id =
        "id must be a non-negative safe integer";
    }
  }

  // -----------------------------------------
  // text
  // -----------------------------------------

  if (hasOwn(transaction, "text")) {
    if (typeof transaction.text !== "string") {
      errors.text = "text must be a string";
    } else {
      if (transaction.text !== transaction.text.trim()) {
        errors.text =
          "text must not have leading or trailing whitespace";
      }

      if (transaction.text.length > MAX_TEXT_LENGTH) {
        errors.text =
          `text must not exceed ${MAX_TEXT_LENGTH} characters`;
      }
    }
  }

  // -----------------------------------------
  // category
  // -----------------------------------------

  if (hasOwn(transaction, "category")) {
    if (typeof transaction.category !== "string") {
      errors.category =
        "category must be a string";
    } else {
      if (transaction.category.trim() === "") {
        errors.category =
          "category must not be empty";
      }

      if (
        transaction.category.length >
        MAX_CATEGORY_LENGTH
      ) {
        errors.category =
          `category must not exceed ${MAX_CATEGORY_LENGTH} characters`;
      }
    }
  }

  // -----------------------------------------
  // amount
  // -----------------------------------------

  if (hasOwn(transaction, "amount")) {
    if (typeof transaction.amount !== "number") {
      errors.amount =
        "amount must be a number";
    } else if (!Number.isFinite(transaction.amount)) {
      errors.amount =
        "amount must be a finite number";
    } else if (transaction.amount === 0) {
      errors.amount =
        "amount must not be zero";
    }
  }

  // -----------------------------------------
  // date
  // -----------------------------------------

  if (hasOwn(transaction, "date")) {
    if (!isStrictISODateString(transaction.date)) {
      errors.date =
        "date must be a valid ISO 8601 UTC timestamp";
    }
  }

  // -----------------------------------------
  // updatedAt
  // -----------------------------------------

  if (hasOwn(transaction, "updatedAt")) {
    if (
      !Number.isSafeInteger(transaction.updatedAt) ||
      transaction.updatedAt < 0
    ) {
      errors.updatedAt =
        "updatedAt must be a non-negative safe integer";
    }
  }

  // -----------------------------------------
  // updatedBy
  // -----------------------------------------

  if (hasOwn(transaction, "updatedBy")) {
    if (
      typeof transaction.updatedBy !== "string" ||
      transaction.updatedBy.trim() === ""
    ) {
      errors.updatedBy =
        "updatedBy must be a non-empty string";
    }
  }

  // -----------------------------------------
  // updatedAt >= date
  // -----------------------------------------

  if (
    isStrictISODateString(transaction.date) &&
    Number.isSafeInteger(transaction.updatedAt) &&
    transaction.updatedAt >= 0
  ) {
    const dateTimestamp = Date.parse(
      transaction.date
    );

    if (transaction.updatedAt < dateTimestamp) {
      errors.updatedAt =
        "updatedAt must not be earlier than date";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return {
      valid: false,
      errors: {
        transactions: "Transactions must be an array"
      }
    };
  }

  const errors = {};
  const ids = new Map();

  transactions.forEach((transaction, index) => {
    const result = validateTransaction(transaction);

    if (!result.valid) {
      errors[index] = result.errors;
    }

    if (
      transaction &&
      typeof transaction === "object" &&
      Number.isSafeInteger(transaction.id)
    ) {
      if (ids.has(transaction.id)) {
        const firstIndex = ids.get(transaction.id);

        errors[index] ??= {};
        errors[index].id =
          `Duplicate transaction ID; first used at index ${firstIndex}`;
      } else {
        ids.set(transaction.id, index);
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateCloudPayload = data => {
  const errors = {};

  // Root object
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {
      valid: false,
      errors: {
        payload: "Cloud payload must be an object"
      }
    };
  }

  // Root fields
  const allowedFields = new Set([
    "version",
    "updatedAt",
    "updatedBy",
    "transactions",
    "chartMode",
    "meta"
  ]);

  for (const key of Object.keys(data)) {
    if (!allowedFields.has(key)) {
      errors[key] = "Unknown cloud payload field";
    }
  }

  // version
  if (
    !Number.isSafeInteger(data.version) ||
    data.version < 0
  ) {
    errors.version =
      "Version must be a non-negative safe integer";
  }

  // updatedAt
  if (
    !Number.isSafeInteger(data.updatedAt) ||
    data.updatedAt < 0
  ) {
    errors.updatedAt =
      "updatedAt must be a non-negative safe integer";
  }

  // updatedBy
  if (
    typeof data.updatedBy !== "string" ||
    data.updatedBy.trim() === ""
  ) {
    errors.updatedBy =
      "updatedBy must be a non-empty string";
  }

  // chartMode
  if (
    data.chartMode !== "pie" &&
    data.chartMode !== "donut"
  ) {
    errors.chartMode =
      'chartMode must be either "pie" or "donut"';
  }

  // transactions
  const transactionResult =
    validateTransactions(data.transactions);

  if (!transactionResult.valid) {
    errors.transactions =
      transactionResult.errors;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
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
  * Pulls data from the cloud using a specific blobId 
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
    const validation =
    validateCloudPayload(data);

    if (!validation.valid) {
      console.warn(
        "Invalid cloud payload:",
        validation.errors
      );

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
