import { ensureAnonymousUser, supabase } from "./supabaseClient.js";
import { deviceId } from "../js/deviceIdentity.js";

/**
 * Pushes the current application state to Supabase.
 *
 * One row is stored for each authenticated Supabase user.
 *
 * @param {Object} params
 * @param {Array} params.transactions
 * @param {Object} params.cloudMeta
 * @param {string} params.chartMode
 * @param {string} params.deviceId
 * @param {Object} params.meta
 * @returns {Promise<Object>} Cloud state using the application's existing format.
 */
export const pushToCloud = async ({
  transactions,
  cloudMeta,
  chartMode,
  deviceId,
  meta = {},
}) => {
  const user = await ensureAnonymousUser();

  const nextVersion =
    (cloudMeta?.version ?? 0) + 1;

  const updatedAt = Date.now();

  const payload = {
    user_id: user.id,
    version: nextVersion,
    updated_at: new Date(updatedAt).toISOString(),
    updated_by: deviceId,
    transactions,
    chart_mode: chartMode,
    meta,
  };

  const {
    data,
    error,
  } = await supabase
    .from("expense_tracker_state")
    .upsert(
      payload,
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  if (error) {
    const cloudError = new Error(
      `Supabase push failed: ${error.message}`
    );

    cloudError.status = error.status;
    cloudError.code = error.code;

    throw cloudError;
  }

  if (!data) {
    throw new Error(
      "Supabase push succeeded but no state was returned"
    );
  }

  return {
    version: Number(data.version),
    updatedAt: Date.parse(data.updated_at),
    updatedBy: data.updated_by,
    transactions: data.transactions,
    chartMode: data.chart_mode,
    meta: data.meta,
    userId: data.user_id,
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

// ------------------------------------------------------------
// Legacy migration helpers
// ------------------------------------------------------------

const LEGACY_MIGRATION_MAX_RETRIES = 3;


/**
 * Determines whether a transaction's updatedBy value
 * should be considered missing.
 *
 * Missing values:
 * - undefined
 * - null
 * - empty string
 * - whitespace-only string
 */
const isMissingUpdatedBy = value => {
  if (
    value === undefined ||
    value === null
  ) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  return false;
};


/**
 * Determines whether the transaction array still
 * contains legacy records that need migration.
 */
const hasLegacyTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return false;
  }

  return transactions.some(
    transaction =>
      transaction &&
      typeof transaction === "object" &&
      isMissingUpdatedBy(
        transaction.updatedBy
      )
  );
};


/**
 * Adds the cloud-level updatedBy value to only those
 * legacy transactions whose updatedBy is missing.
 *
 * Existing non-blank transaction-level updatedBy
 * values are preserved.
 */
const migrateLegacyTransactions = (
  transactions,
  fallbackUpdatedBy
) => {
  return transactions.map(transaction => ({
    ...transaction,
    updatedBy:
      isMissingUpdatedBy(
        transaction.updatedBy
      )
        ? fallbackUpdatedBy
        : transaction.updatedBy
  }));
};


/**
 * Converts a Supabase state row into the application's
 * cloud payload format.
 */
const createCloudPayload = data => ({
  version: Number(data.version),
  updatedAt: Date.parse(data.updated_at),
  updatedBy: data.updated_by,
  transactions: data.transactions,
  chartMode: data.chart_mode,
  meta: data.meta
});


/**
 * Checks whether the cloud-level updatedBy value is
 * usable as the migration fallback.
 */
const hasValidMigrationFallback = updatedBy => {
  return (
    typeof updatedBy === "string" &&
    updatedBy.trim() !== ""
  );
};


/**
 * Fetches the latest state for the current Supabase user.
 *
 * Used after an optimistic version conflict so the
 * migration can determine whether legacy records still
 * exist before attempting another write.
 */
const fetchLatestCloudState = async userId => {
  const {
    data,
    error
  } = await supabase
    .from("expense_tracker_state")
    .select(
      "version, updated_at, updated_by, transactions, chart_mode, meta"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error
    };
  }

  if (!data) {
    return {
      data: null,
      error: new Error(
        "Could not retrieve latest cloud state for migration retry"
      )
    };
  }

  return {
    data,
    error: null
  };
};


/**
 * Attempts one optimistic legacy-migration write.
 *
 * The version condition makes sure we only update the
 * exact cloud version that we originally read.
 *
 * Returns:
 * - migratedData when the update succeeds
 * - null when the cloud version changed
 */
const persistLegacyMigration = async ({
  userId,
  currentVersion,
  transactions,
  chartMode,
  meta
}) => {
  const migratedVersion =
    currentVersion + 1;

  const migratedAt =
    new Date().toISOString();

  const {
    data,
    error
  } = await supabase
    .from("expense_tracker_state")
    .update({
      transactions,

      chart_mode:
        chartMode,

      meta,

      version:
        migratedVersion,

      updated_at:
        migratedAt,

      updated_by:
        deviceId
    })
    .eq("user_id", userId)
    .eq("version", currentVersion)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};


/**
 * Performs the complete legacy transaction migration.
 *
 * The migration:
 * 1. Detects legacy transactions.
 * 2. Validates the cloud-level fallback.
 * 3. Migrates missing transaction updatedBy values.
 * 4. Attempts an optimistic write.
 * 5. On version conflict, fetches the latest state.
 * 6. Retries only if legacy records still exist.
 * 7. Stops without rewriting when another device already
 *    completed the migration.
 */
const migrateLegacyCloudState = async ({
  cloudPayload,
  user
}) => {
  if (
    !hasLegacyTransactions(
      cloudPayload.transactions
    )
  ) {
    return cloudPayload;
  }


  // The cloud-level updatedBy value is the only
  // legitimate fallback for legacy transactions.
  if (
    !hasValidMigrationFallback(
      cloudPayload.updatedBy
    )
  ) {
    console.warn(
      "Legacy transactions require updatedBy, but the cloud updated_by value is invalid."
    );

    return cloudPayload;
  }


  // Normalize the initially fetched cloud state.
  cloudPayload.transactions =
    migrateLegacyTransactions(
      cloudPayload.transactions,
      cloudPayload.updatedBy
    );


  for (
    let attempt = 1;
    attempt <= LEGACY_MIGRATION_MAX_RETRIES;
    attempt++
  ) {
    const currentVersion =
      Number(cloudPayload.version);


    const migratedData =
      await persistLegacyMigration({
        userId: user.id,

        currentVersion,

        transactions:
          cloudPayload.transactions,

        chartMode:
          cloudPayload.chartMode,

        meta:
          cloudPayload.meta
      });


    // ----------------------------------------------------------
    // Migration succeeded.
    // ----------------------------------------------------------

    if (migratedData) {
      const migratedPayload =
        createCloudPayload(
          migratedData
        );

      console.info(
        "Legacy transactions migrated and persisted to Supabase."
      );

      return migratedPayload;
    }


    // ----------------------------------------------------------
    // Optimistic version conflict.
    //
    // The cloud changed after we initially fetched it.
    // Fetch the newest state before considering another retry.
    // ----------------------------------------------------------

    if (
      attempt >=
      LEGACY_MIGRATION_MAX_RETRIES
    ) {
      console.warn(
        "Legacy transaction migration stopped after the maximum number of retries."
      );

      return cloudPayload;
    }


    const latestResult =
      await fetchLatestCloudState(user.id);

    if (
      latestResult.error ||
      !latestResult.data
    ) {
      console.warn(
        "Could not retrieve the latest cloud state for legacy migration retry:",
        latestResult.error
      );

      return cloudPayload;
    }

    const latestPayload =
      createCloudPayload(
        latestResult.data
      );


    // ----------------------------------------------------------
    // IMPORTANT:
    //
    // Another device may already have migrated the records.
    // If no legacy records remain, stop immediately.
    // Do NOT increment the version again.
    // ----------------------------------------------------------

    if (
      !hasLegacyTransactions(
        latestPayload.transactions
      )
    ) {
      console.info(
        "Legacy transactions were already migrated by another device. No additional rewrite was performed."
      );

      return latestPayload;
    }


    // ----------------------------------------------------------
    // Legacy records still remain.
    //
    // We need a valid cloud-level fallback before retrying.
    // ----------------------------------------------------------

    if (
      !hasValidMigrationFallback(
        latestPayload.updatedBy
      )
    ) {
      console.warn(
        "Legacy transactions still remain, but the latest cloud updated_by value is invalid. Migration stopped."
      );

      return latestPayload;
    }


    // ----------------------------------------------------------
    // Prepare the newest state for the next optimistic write.
    // ----------------------------------------------------------

    latestPayload.transactions =
      migrateLegacyTransactions(
        latestPayload.transactions,
        latestPayload.updatedBy
      );


    cloudPayload.version =
      latestPayload.version;

    cloudPayload.updatedAt =
      latestPayload.updatedAt;

    cloudPayload.updatedBy =
      latestPayload.updatedBy;

    cloudPayload.transactions =
      latestPayload.transactions;

    cloudPayload.chartMode =
      latestPayload.chartMode;

    cloudPayload.meta =
      latestPayload.meta;
  }


  return cloudPayload;
};

/**
 * Pulls the current user's state from Supabase.
 *
 * The Supabase user identity replaces the old JSONBlob blobId.
 *
 * @param {Object} options
 * @param {AbortSignal} options.signal
 * @returns {Promise<Object|null>}
 */
export const pullFromCloud = async ({
  signal: callerSignal
} = {}) => {
  const {
    signal,
    cleanup
  } = createPullSignal(
    CLOUD_PULL_TIMEOUT,
    callerSignal
  );

  try {
    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );

      return null;
    }


    const user =
      await ensureAnonymousUser();


    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );

      return null;
    }


    const {
      data,
      error
    } = await supabase
      .from("expense_tracker_state")
      .select(
        "version, updated_at, updated_by, transactions, chart_mode, meta"
      )
      .eq("user_id", user.id)
      .maybeSingle();


    if (signal.aborted) {
      console.warn(
        "Cloud pull cancelled or timed out"
      );

      return null;
    }


    if (error) {
      console.warn(
        "Supabase pull failed:",
        error
      );

      return null;
    }


    if (!data) {
      console.info(
        "No cloud state exists for this Supabase user yet."
      );

      return null;
    }


    // ----------------------------------------------------------
    // Convert Supabase row into application cloud payload.
    // ----------------------------------------------------------

    let cloudPayload =
      createCloudPayload(data);


    // ----------------------------------------------------------
    // Migrate legacy transactions if required.
    // ----------------------------------------------------------

    cloudPayload =
      await migrateLegacyCloudState({
        cloudPayload,
        user
      });


    // ----------------------------------------------------------
    // Existing validation remains unchanged.
    // ----------------------------------------------------------

    const validation =
      validateCloudPayload(
        cloudPayload
      );


    if (!validation.valid) {
      console.warn(
        "Invalid Supabase cloud payload:",
        validation.errors
      );

      return null;
    }


    return cloudPayload;

  } catch (error) {
    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );
    } else if (
      error?.name === "TimeoutError"
    ) {
      console.warn(
        "Cloud pull timed out"
      );
    } else {
      console.warn(
        "Cloud pull unavailable:",
        error
      );
    }

    return null;

  } finally {
    cleanup();
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
